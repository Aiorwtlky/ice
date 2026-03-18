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

/** PATCH: 更新班級（主講師、名稱、代碼、活動分類綁定可選） */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const { id } = await params;
  const group = await prisma.classGroup.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: '找不到班級' }, { status: 404 });
  const body = await request.json();
  const { name, schoolCode, teacherId, activeTermId } = body;

  const data: { name?: string; schoolCode?: string; teacherId?: string; activeTermId?: string | null } = {};
  if (typeof name === 'string' && name.trim()) data.name = name.trim();
  if (typeof schoolCode === 'string' && schoolCode.trim()) data.schoolCode = schoolCode.trim();
  if (typeof teacherId === 'string') {
    const t = await prisma.user.findUnique({ where: { id: teacherId }, select: { role: true } });
    if (t?.role !== 'TEACHER') return NextResponse.json({ error: '主講師須為教師帳號' }, { status: 400 });
    data.teacherId = teacherId;
  }
  if (activeTermId === null) data.activeTermId = null;
  else if (typeof activeTermId === 'string') {
    const term = await prisma.term.findUnique({ where: { id: activeTermId } });
    if (!term) return NextResponse.json({ error: '活動分類不存在' }, { status: 400 });
    data.activeTermId = activeTermId;
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: '無可更新欄位' }, { status: 400 });
  const updated = await prisma.classGroup.update({ where: { id }, data });
  return NextResponse.json({ classGroup: updated });
}
