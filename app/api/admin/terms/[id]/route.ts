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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const { name, isActive } = body as { name?: unknown; isActive?: unknown };
  const data: { name?: string; isActive?: boolean } = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name 格式錯誤' }, { status: 400 });
    }
    data.name = name.trim();
  }
  if (isActive !== undefined) {
    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive 格式錯誤' }, { status: 400 });
    }
    data.isActive = isActive;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '請提供可更新欄位（name 或 isActive）' }, { status: 400 });
  }

  const term = await prisma.term.update({ where: { id }, data });
  return NextResponse.json({ term });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const { id } = await params;
  const using = await prisma.classGroup.count({ where: { activeTermId: id } });
  if (using > 0) return NextResponse.json({ error: `仍有 ${using} 個班級綁定此分類，請先解除` }, { status: 400 });
  const mods = await prisma.gameModule.count({ where: { termId: id } });
  if (mods > 0) return NextResponse.json({ error: '此分類下仍有活動模組，請先於後台處理模組後再刪除' }, { status: 400 });
  await prisma.term.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
