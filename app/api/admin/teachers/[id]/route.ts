import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
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

/** PATCH: 更新講師姓名、密碼 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.role !== 'TEACHER') return NextResponse.json({ error: '僅能編輯講師帳號' }, { status: 404 });
  const body = await request.json();
  const { name, password } = body;
  const data: { name?: string | null; passwordHash?: string } = {};
  if (typeof name === 'string') data.name = name.trim() || null;
  if (typeof password === 'string' && password.length > 0) data.passwordHash = await bcrypt.hash(password, 10);
  if (Object.keys(data).length === 0) return NextResponse.json({ error: '請提供 name 或 password' }, { status: 400 });
  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, account: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user: updated });
}

/** DELETE: 刪除講師（不可為任一班級主講師） */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.role !== 'TEACHER') return NextResponse.json({ error: '僅能刪除講師帳號' }, { status: 404 });
  const mainCount = await prisma.classGroup.count({ where: { teacherId: id } });
  if (mainCount > 0) return NextResponse.json({ error: `此講師仍為 ${mainCount} 個班級的主講師，請先變更主講師後再刪除` }, { status: 400 });
  await prisma.classGroupTeacher.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
