import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { accountLookupKey, normalizeAccountInput } from '@/lib/account-normalize';

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

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const users = await prisma.user.findMany({
    select: { id: true, account: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const body = await request.json();
  const { account, name, password, role } = body;
  if (!account || !password || !role) return NextResponse.json({ error: '請提供 account, password, role' }, { status: 400 });
  if (!['TEACHER', 'ADMIN'].includes(role)) return NextResponse.json({ error: 'role 僅限 TEACHER 或 ADMIN' }, { status: 400 });
  const normalizedAccount = normalizeAccountInput(String(account));
  const lookupKey = accountLookupKey(normalizedAccount);
  const existsByLoose = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "users"
    WHERE REPLACE(UPPER("account"), '-', '') = ${lookupKey}
    LIMIT 1
  `;
  if (existsByLoose[0]) return NextResponse.json({ error: '帳號已存在（含大小寫與連字號視為同帳號）' }, { status: 400 });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      account: normalizedAccount,
      name: typeof name === 'string' && name.trim() ? name.trim() : normalizedAccount,
      role: role as UserRole,
      passwordHash,
    },
  });
  return NextResponse.json({ user: { id: user.id, account: user.account, name: user.name, role: user.role } });
}
