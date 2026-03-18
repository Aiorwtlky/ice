import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const uid = payload.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, role: true, teacherGroups: { select: { id: true } } },
    });
    return user;
  } catch {
    return null;
  }
}

/** DELETE: 將學員移出本班（不刪帳號，僅解除 studentGroupId） */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: '未登入' }, { status: 401 });
    if (auth.role !== 'TEACHER' && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }
    const { id, userId } = await params;
    if (auth.role === 'TEACHER') {
      const main = auth.teacherGroups.some((g) => g.id === id);
      if (!main) return NextResponse.json({ error: '只能操作自己的班級' }, { status: 403 });
    }
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { studentGroupId: true },
    });
    if (!target || target.studentGroupId !== id) {
      return NextResponse.json({ error: '該學員不在本班' }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { studentGroupId: null },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
