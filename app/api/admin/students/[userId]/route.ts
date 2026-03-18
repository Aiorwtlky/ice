import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
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

/** PATCH: 重置密碼。body: { password: string } */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const { userId } = await params;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return NextResponse.json({ error: '找不到使用者' }, { status: 404 });
  if (target.role !== 'STUDENT') return NextResponse.json({ error: '僅能重置學員密碼' }, { status: 400 });
  const body = await request.json();
  const password = body.password;
  if (!password || typeof password !== 'string') return NextResponse.json({ error: '請提供 password' }, { status: 400 });
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return NextResponse.json({ success: true });
}

/** DELETE: 刪除學員帳號（僅學員，且會解除班級綁定） */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const { userId } = await params;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return NextResponse.json({ error: '找不到使用者' }, { status: 404 });
  if (target.role !== 'STUDENT') return NextResponse.json({ error: '僅能刪除學員' }, { status: 400 });
  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}
