import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');

async function getTeacherClassIds() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        teacherGroups: { select: { id: true } },
      },
    });
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) return null;
    const main = user.teacherGroups.map((g) => g.id);
    return [...new Set([...main])];
  } catch { return null; }
}

/** GET: 本班學習歷程。query: classGroupId (必填，且須為自己負責的班), userId? */
export async function GET(request: NextRequest) {
  const classIds = await getTeacherClassIds();
  if (!classIds?.length) return NextResponse.json({ error: '未登入或權限不足' }, { status: 403 });
  const classGroupId = request.nextUrl.searchParams.get('classGroupId');
  if (!classGroupId) return NextResponse.json({ error: '請提供 classGroupId' }, { status: 400 });
  if (!classIds.includes(classGroupId)) return NextResponse.json({ error: '僅能查看自己負責的班級' }, { status: 403 });
  const userId = request.nextUrl.searchParams.get('userId');

  const where: { userId?: string | { in: string[] } } = {};
  if (userId) where.userId = userId;
  else {
    const students = await prisma.user.findMany({
      where: { studentGroupId: classGroupId },
      select: { id: true },
    });
    const ids = students.map((s) => s.id);
    if (!ids.length) return NextResponse.json({ logs: [] });
    where.userId = { in: ids };
  }

  const logs = await prisma.learningLog.findMany({
    where,
    include: {
      user: { select: { id: true, account: true, name: true } },
      gameModule: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  return NextResponse.json({ logs });
}
