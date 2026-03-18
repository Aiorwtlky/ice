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

/** PATCH: 加入或移除班級教師。body: { userId: string, action: 'add' | 'remove' } */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const { id } = await params;
  const group = await prisma.classGroup.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: '找不到班級' }, { status: 404 });
  const body = await request.json();
  const { userId, action } = body;
  if (!userId || !action || !['add', 'remove'].includes(action)) {
    return NextResponse.json({ error: '請提供 userId 與 action (add | remove)' }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (target?.role !== 'TEACHER') return NextResponse.json({ error: '僅能指派 TEACHER' }, { status: 400 });
  if (action === 'add') {
    await prisma.classGroupTeacher.upsert({
      where: { classGroupId_userId: { classGroupId: id, userId } },
      create: { classGroupId: id, userId },
      update: {},
    });
  } else {
    await prisma.classGroupTeacher.deleteMany({ where: { classGroupId: id, userId } });
  }
  return NextResponse.json({ success: true });
}
