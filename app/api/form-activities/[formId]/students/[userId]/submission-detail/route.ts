import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, UserRole } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';
import { answerToClientValue } from '@/app/api/_utils/forms';

const prisma = new PrismaClient();

async function canAccessClass(userId: string, role: UserRole, classGroupId: string) {
  if (role === UserRole.ADMIN) {
    const cg = await prisma.classGroup.findUnique({ where: { id: classGroupId }, select: { id: true } });
    return !!cg;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      teacherGroups: { select: { id: true } },
      classGroupTeacherAssignments: { select: { classGroupId: true } },
    },
  });
  if (!user) return false;
  const ids = new Set([
    ...user.teacherGroups.map((g) => g.id),
    ...user.classGroupTeacherAssignments.map((a) => a.classGroupId),
  ]);
  return ids.has(classGroupId);
}

/** GET: 單一學生在該表單的最新提交內容 + 作答事件 log */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ formId: string; userId: string }> }
) {
  try {
    const auth = await getAuthUser(prisma);
    if (!auth || (auth.role !== UserRole.TEACHER && auth.role !== UserRole.ADMIN)) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const { formId, userId } = await context.params;
    const classGroupId = request.nextUrl.searchParams.get('classGroupId')?.trim();
    if (!classGroupId) {
      return NextResponse.json({ error: '請提供 classGroupId' }, { status: 400 });
    }

    const ok = await canAccessClass(auth.id, auth.role, classGroupId);
    if (!ok) {
      return NextResponse.json({ error: '無權查看此班級' }, { status: 403 });
    }

    const form = await prisma.formActivity.findUnique({
      where: { id: formId },
      select: { id: true, title: true },
    });
    if (!form) {
      return NextResponse.json({ error: '找不到表單' }, { status: 404 });
    }

    const student = await prisma.user.findFirst({
      where: {
        id: userId,
        studentGroupId: classGroupId,
        role: UserRole.STUDENT,
      },
      select: { id: true, account: true, name: true, gender: true, grade: true },
    });
    if (!student) {
      return NextResponse.json({ error: '找不到該學員' }, { status: 404 });
    }

    const latestSubmission = await prisma.formSubmission.findFirst({
      where: { formActivityId: formId, userId },
      orderBy: [{ attemptNumber: 'desc' }, { updatedAt: 'desc' }],
      include: {
        answers: {
          include: {
            question: {
              select: { id: true, title: true, type: true, orderIndex: true },
            },
          },
        },
      },
    });

    const logs = await prisma.formAnswerLog.findMany({
      where: { formActivityId: formId, userId },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        actionType: true,
        detail: true,
        createdAt: true,
        submissionId: true,
        questionId: true,
      },
    });

    const sortedAnswers = latestSubmission
      ? [...latestSubmission.answers].sort((a, b) => a.question.orderIndex - b.question.orderIndex)
      : [];

    return NextResponse.json({
      form: { id: form.id, title: form.title },
      student: {
        id: student.id,
        account: student.account,
        name: student.name,
        gender: student.gender,
        grade: student.grade,
      },
      submission: latestSubmission
        ? {
            id: latestSubmission.id,
            status: latestSubmission.status,
            attemptNumber: latestSubmission.attemptNumber,
            submittedAt: latestSubmission.submittedAt?.toISOString() ?? null,
            updatedAt: latestSubmission.updatedAt.toISOString(),
            answers: sortedAnswers.map((a, index) => ({
              id: a.id,
              orderIndex: index,
              questionId: a.questionId,
              questionTitle: a.question.title,
              questionType: a.question.type,
              value: answerToClientValue(a),
            })),
          }
        : null,
      logs: logs.map((l) => ({
        id: l.id,
        actionType: l.actionType,
        detail: l.detail,
        createdAt: l.createdAt.toISOString(),
        submissionId: l.submissionId,
        questionId: l.questionId,
      })),
    });
  } catch (error) {
    console.error('GET submission-detail:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
