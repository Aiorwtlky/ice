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
  const { termId, code, name, description } = body;
  if (!termId || !code || !name) return NextResponse.json({ error: '請提供 termId, code, name' }, { status: 400 });
  const module_ = await prisma.gameModule.create({ data: { termId, code, name, description: description || null } });
  return NextResponse.json({ gameModule: module_ });
}
