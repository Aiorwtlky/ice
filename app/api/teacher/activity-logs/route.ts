import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { answerToClientValue } from '@/app/api/_utils/forms';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');

async function teacherClassIds(): Promise<{ role: string; classIds: string[] } | null> {
  const token = (await cookies()).get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      select: {
        role: true,
        teacherGroups: { select: { id: true } },
        classGroupTeacherAssignments: { select: { classGroupId: true } },
      },
    });
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) return null;
    const a = user.teacherGroups.map((g) => g.id);
    const b = user.classGroupTeacherAssignments.map((x) => x.classGroupId);
    return { role: user.role, classIds: [...new Set([...a, ...b])] };
  } catch {
    return null;
  }
}

/** 單一學員在單一活動的學習 log（僅該 gameModuleId） */
export async function GET(request: NextRequest) {
  const ctx = await teacherClassIds();
  if (!ctx) return NextResponse.json({ error: '未登入或權限不足' }, { status: 403 });

  const classGroupId = request.nextUrl.searchParams.get('classGroupId');
  const gameModuleId = request.nextUrl.searchParams.get('gameModuleId');
  const userId = request.nextUrl.searchParams.get('userId');
  if (!classGroupId || !gameModuleId || !userId) {
    return NextResponse.json({ error: '請提供 classGroupId、gameModuleId、userId' }, { status: 400 });
  }
  const okClass =
    ctx.role === 'ADMIN' ? !!(await prisma.classGroup.findUnique({ where: { id: classGroupId }, select: { id: true } })) : ctx.classIds.includes(classGroupId);
  if (!okClass) return NextResponse.json({ error: '僅能查看自己負責的班級' }, { status: 403 });

  const student = await prisma.user.findFirst({
    where: { id: userId, studentGroupId: classGroupId, role: 'STUDENT' },
    select: { id: true, account: true, name: true },
  });
  if (!student) return NextResponse.json({ error: '找不到該學員' }, { status: 404 });

  const logs = await prisma.learningLog.findMany({
    where: { userId, gameModuleId },
    orderBy: { createdAt: 'desc' },
    take: 400,
    select: { id: true, actionType: true, detail: true, createdAt: true },
  });

  const gameModule = await prisma.gameModule.findUnique({
    where: { id: gameModuleId },
    select: {
      code: true,
      formActivity: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  let formSubmission = null;
  if (gameModule?.formActivity) {
    const latestSubmission = await prisma.formSubmission.findFirst({
      where: {
        formActivityId: gameModule.formActivity.id,
        userId,
      },
      orderBy: [{ attemptNumber: 'desc' }, { updatedAt: 'desc' }],
      include: {
        answers: {
          include: {
            question: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (latestSubmission) {
      formSubmission = {
        id: latestSubmission.id,
        status: latestSubmission.status,
        attemptNumber: latestSubmission.attemptNumber,
        submittedAt: latestSubmission.submittedAt?.toISOString() ?? null,
        updatedAt: latestSubmission.updatedAt.toISOString(),
        title: gameModule.formActivity.title,
        answers: latestSubmission.answers.map((answer) => ({
          id: answer.id,
          questionId: answer.questionId,
          questionTitle: answer.question.title,
          questionType: answer.question.type,
          value: answerToClientValue(answer),
        })),
      };
    }
  }

  return NextResponse.json({
    student: { account: student.account, name: student.name },
    formSubmission,
    logs: logs.map((l) => ({
      id: l.id,
      actionType: l.actionType,
      detail: l.detail,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
