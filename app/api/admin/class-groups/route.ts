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
    return user?.role === 'ADMIN' ? true : null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const body = await request.json();
  const { name, schoolCode, teacherId } = body;
  // 班級是永久存在的實體：不再把「活動分類」綁在班級上
  if (!name || !schoolCode || !teacherId) return NextResponse.json({ error: '請提供 name, schoolCode, teacherId' }, { status: 400 });
  const group = await prisma.classGroup.create({ data: { name, schoolCode, teacherId } });
  return NextResponse.json({ classGroup: group });
}
