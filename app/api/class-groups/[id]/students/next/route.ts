import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, teacherGroups: { select: { id: true } } },
    });
    return user;
  } catch {
    return null;
  }
}

function computeNextNumber(accounts: string[], prefix: string) {
  let max = 0;
  for (const a of accounts) {
    if (!a.startsWith(prefix)) continue;
    const rest = a.slice(prefix.length);
    const n = Number(rest);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/** GET: 產生下一個流水號學員帳密（老師/管理員） */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: '未登入' }, { status: 401 });
    if (auth.role !== 'TEACHER' && auth.role !== 'ADMIN') return NextResponse.json({ error: '權限不足' }, { status: 403 });

    const { id } = await params;
    if (auth.role === 'TEACHER') {
      const main = auth.teacherGroups.some((g) => g.id === id);
      if (!main) return NextResponse.json({ error: '只能操作自己的班級' }, { status: 403 });
    }

    const group = await prisma.classGroup.findUnique({
      where: { id },
      select: { schoolCode: true },
    });
    if (!group) return NextResponse.json({ error: '找不到班級' }, { status: 404 });
    const schoolCode = group.schoolCode;
    const prefix = `${schoolCode}-`;

    const students = await prisma.user.findMany({
      where: { studentGroupId: id, account: { startsWith: prefix } },
      select: { account: true },
      take: 5000,
    });
    let nextNum = computeNextNumber(students.map((s) => s.account), prefix);

    // 避免跳號已存在：往上找第一個沒被占用的
    // (查全部 users，不只本班)
    while (true) {
      const account = `${prefix}${String(nextNum).padStart(2, '0')}`;
      const exists = await prisma.user.findUnique({ where: { account }, select: { id: true } });
      if (!exists) break;
      nextNum += 1;
    }

    const account = `${prefix}${String(nextNum).padStart(2, '0')}`;
    const password = `88${String(nextNum).padStart(2, '0')}`;
    return NextResponse.json({ account, password, number: nextNum });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

