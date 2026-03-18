import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId as string }, select: { role: true } });
    return user?.role === 'ADMIN';
  } catch { return null; }
}

/** GET: 學習歷程。query: classGroupId?（不帶則全平台學員）、userId? */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const { searchParams } = request.nextUrl;
  const classGroupId = searchParams.get('classGroupId');
  const userId = searchParams.get('userId');

  const baseInclude = {
    user: { select: { id: true, account: true, name: true, role: true } },
    gameModule: { select: { id: true, code: true, name: true } },
  } as const;

  if (userId) {
    const logs = await prisma.learningLog.findMany({
      where: { userId },
      include: baseInclude,
      orderBy: { createdAt: 'desc' },
      take: 800,
    });
    return NextResponse.json({ logs });
  }

  if (classGroupId) {
    const students = await prisma.user.findMany({
      where: { studentGroupId: classGroupId },
      select: { id: true },
    });
    const ids = students.map((s) => s.id);
    if (!ids.length) return NextResponse.json({ logs: [] });
    const logs = await prisma.learningLog.findMany({
      where: { userId: { in: ids } },
      include: baseInclude,
      orderBy: { createdAt: 'desc' },
      take: 800,
    });
    return NextResponse.json({ logs });
  }

  const logs = await prisma.learningLog.findMany({
    where: { user: { role: 'STUDENT' } },
    include: baseInclude,
    orderBy: { createdAt: 'desc' },
    take: 800,
  });
  return NextResponse.json({ logs });
}
