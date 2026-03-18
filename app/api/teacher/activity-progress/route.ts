import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

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
    const classIds = [...new Set([...a, ...b])];
    return { role: user.role, classIds };
  } catch {
    return null;
  }
}

/** 本活動每位學員最近一次通關（COMPLETE）時間；僅限老師班級 */
export async function GET(request: NextRequest) {
  const ctx = await teacherClassIds();
  if (!ctx) return NextResponse.json({ error: '未登入或權限不足' }, { status: 403 });

  const classGroupId = request.nextUrl.searchParams.get('classGroupId');
  const gameModuleId = request.nextUrl.searchParams.get('gameModuleId');
  if (!classGroupId || !gameModuleId) {
    return NextResponse.json({ error: '請提供 classGroupId、gameModuleId' }, { status: 400 });
  }
  const okClass =
    ctx.role === 'ADMIN' ? !!(await prisma.classGroup.findUnique({ where: { id: classGroupId }, select: { id: true } })) : ctx.classIds.includes(classGroupId);
  if (!okClass) return NextResponse.json({ error: '僅能查看自己負責的班級' }, { status: 403 });

  const students = await prisma.user.findMany({
    where: { studentGroupId: classGroupId, role: 'STUDENT' },
    select: { id: true, account: true, gender: true, grade: true },
    orderBy: { account: 'asc' },
  });
  const ids = students.map((s) => s.id);
  if (!ids.length) return NextResponse.json({ students: [] });

  const completes = await prisma.learningLog.findMany({
    where: {
      gameModuleId,
      actionType: 'COMPLETE',
      userId: { in: ids },
    },
    orderBy: { createdAt: 'desc' },
    select: { userId: true, createdAt: true },
  });

  const lastByUser = new Map<string, Date>();
  for (const row of completes) {
    if (!lastByUser.has(row.userId)) lastByUser.set(row.userId, row.createdAt);
  }

  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      account: s.account,
      gender: s.gender ?? null,
      grade: s.grade ?? null,
      lastCompleteAt: lastByUser.get(s.id)?.toISOString() ?? null,
    })),
  });
}
