import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { accountLookupKey, normalizeAccountInput } from '@/lib/account-normalize';

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

/** POST: 批次生成 N 個學員帳號，密碼 88+流水號，加入本班 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: '未登入' }, { status: 401 });
    if (auth.role !== 'TEACHER' && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }
    const { id } = await params;
    const group = await prisma.classGroup.findUnique({ where: { id } });
    if (!group) return NextResponse.json({ error: '找不到班級' }, { status: 404 });
    if (auth.role === 'TEACHER') {
      const main = auth.teacherGroups.some((g) => g.id === id);
      if (!main) return NextResponse.json({ error: '只能操作自己的班級' }, { status: 403 });
    }

    const body = await request.json();
    const count = Math.min(Math.max(Number(body.count) || 1, 1), 100);
    const prefix = normalizeAccountInput(String(body.prefix ?? group.schoolCode));
    const startFrom = Number(body.startFrom) || 1;
    const defaultPassword = body.defaultPassword ?? '88'; // 預設密碼：可傳 "88" 表示 8801,8802… 或固定字串

    const created: { account: string; password: string }[] = [];
    for (let i = 0; i < count; i++) {
      const num = startFrom + i;
      const account = normalizeAccountInput(`${prefix}-${String(num).padStart(2, '0')}`);
      const password = /^\d+$/.test(String(defaultPassword))
        ? defaultPassword + String(num).padStart(2, '0')
        : String(defaultPassword);
      const existsByLoose = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "users"
        WHERE REPLACE(UPPER("account"), '-', '') = ${accountLookupKey(account)}
        LIMIT 1
      `;
      if (existsByLoose[0]) continue;
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          account,
          name: null,
          role: UserRole.STUDENT,
          schoolCode: group.schoolCode,
          passwordHash,
          studentGroupId: id,
        },
      });
      created.push({ account, password });
    }
    return NextResponse.json({ success: true, created });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
