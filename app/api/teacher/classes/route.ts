import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');

async function getTeacher() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        teacherGroups: { select: { id: true } },
      },
    });
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) return null;
    return user;
  } catch { return null; }
}

/** GET: 教師負責的班級（主講師 + 被指派的班級） */
export async function GET() {
  const teacher = await getTeacher();
  if (!teacher) return NextResponse.json({ error: '未登入或權限不足' }, { status: 403 });
  const mainIds = teacher.teacherGroups.map((g) => g.id);
  // 單班規則：老師只看自己主講班（不支援被指派到多班）
  const allIds = [...new Set([...mainIds])];
  if (allIds.length === 0) return NextResponse.json({ classes: [] });
  const classes = await prisma.classGroup.findMany({
    where: { id: { in: allIds } },
    include: {
      activeTerm: { select: { id: true, name: true } },
      teacher: { select: { id: true, account: true, name: true } },
      _count: { select: { students: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ classes });
}
