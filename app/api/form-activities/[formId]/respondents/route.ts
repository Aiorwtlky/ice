import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, UserRole } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';

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

/** GET: 某班在此表單的填答摘要（每位學生最新一筆 submission） */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ formId: string }> }
) {
  try {
    const auth = await getAuthUser(prisma);
    if (!auth || (auth.role !== UserRole.TEACHER && auth.role !== UserRole.ADMIN)) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const { formId } = await context.params;
    const classGroupId = request.nextUrl.searchParams.get('classGroupId')?.trim();
    if (!classGroupId) {
      return NextResponse.json({ error: '請提供 classGroupId' }, { status: 400 });
    }

    const form = await prisma.formActivity.findUnique({
      where: { id: formId },
      select: { id: true, title: true },
    });
    if (!form) {
      return NextResponse.json({ error: '找不到表單' }, { status: 404 });
    }

    const ok = await canAccessClass(auth.id, auth.role, classGroupId);
    if (!ok) {
      return NextResponse.json({ error: '無權查看此班級' }, { status: 403 });
    }

    const classGroup = await prisma.classGroup.findUnique({
      where: { id: classGroupId },
      select: { id: true, name: true, schoolCode: true },
    });
    if (!classGroup) {
      return NextResponse.json({ error: '找不到班級' }, { status: 404 });
    }

    const students = await prisma.user.findMany({
      where: { studentGroupId: classGroupId, role: UserRole.STUDENT },
      select: {
        id: true,
        account: true,
        name: true,
        gender: true,
        grade: true,
      },
      orderBy: { account: 'asc' },
    });

    const studentIds = students.map((s) => s.id);
    if (studentIds.length === 0) {
      return NextResponse.json({
        form: { id: form.id, title: form.title },
        classGroup,
        students: [],
      });
    }

    const submissions = await prisma.formSubmission.findMany({
      where: {
        formActivityId: formId,
        userId: { in: studentIds },
      },
      orderBy: [{ attemptNumber: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        userId: true,
        status: true,
        attemptNumber: true,
        submittedAt: true,
        updatedAt: true,
        _count: { select: { answers: true } },
      },
    });

    const latestByUser = new Map<string, (typeof submissions)[0]>();
    for (const sub of submissions) {
      if (!latestByUser.has(sub.userId)) latestByUser.set(sub.userId, sub);
    }

    return NextResponse.json({
      form: { id: form.id, title: form.title },
      classGroup,
      students: students.map((s) => {
        const sub = latestByUser.get(s.id);
        return {
          id: s.id,
          account: s.account,
          name: s.name,
          gender: s.gender,
          grade: s.grade,
          submission: sub
            ? {
                id: sub.id,
                status: sub.status,
                attemptNumber: sub.attemptNumber,
                submittedAt: sub.submittedAt?.toISOString() ?? null,
                updatedAt: sub.updatedAt.toISOString(),
                answerCount: sub._count.answers,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error('GET /api/form-activities/[formId]/respondents:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
