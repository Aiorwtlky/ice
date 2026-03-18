import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function getUser() {
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
        passwordHash: true,
        teacherGroups: { select: { id: true } },
      },
    });
    return user;
  } catch {
    return null;
  }
}

/** PATCH: 設定該班級 loginLocked（僅 TEACHER/ADMIN，老師只能改自己的班） */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });
    if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: '僅老師或管理員可操作' }, { status: 403 });
    }
    const { id } = await params;
    const group = await prisma.classGroup.findUnique({ where: { id } });
    if (!group) return NextResponse.json({ error: '找不到班級' }, { status: 404 });
    if (user.role === 'TEACHER') {
      const main = user.teacherGroups.some((g) => g.id === id);
      if (!main) return NextResponse.json({ error: '只能操作自己的班級' }, { status: 403 });
    }
    const body = await request.json();
    const loginLocked = !!body.loginLocked;

    // 老師要「鎖定」時需輸入密碼確認（避免誤觸）
    if (user.role === 'TEACHER' && loginLocked === true) {
      const password = typeof body.password === 'string' ? body.password : '';
      if (!password) return NextResponse.json({ error: '請輸入老師密碼以確認鎖定' }, { status: 400 });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return NextResponse.json({ error: '老師密碼錯誤' }, { status: 403 });
    }

    await prisma.classGroup.update({
      where: { id },
      data: { loginLocked },
    });
    return NextResponse.json({ success: true, loginLocked });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
