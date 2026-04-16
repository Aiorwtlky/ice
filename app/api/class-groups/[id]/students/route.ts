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

/** GET: 列出該班學員（僅老師/管理員，老師僅能看自己的班） */
export async function GET(
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
    const group = await prisma.classGroup.findUnique({
      where: { id },
      include: { students: { select: { id: true, account: true, name: true, gender: true, grade: true, onboardingDone: true } } },
    });
    if (!group) return NextResponse.json({ error: '找不到班級' }, { status: 404 });
    if (auth.role === 'TEACHER') {
      const main = auth.teacherGroups.some((g) => g.id === id);
      if (!main) return NextResponse.json({ error: '只能查看自己的班級' }, { status: 403 });
    }
    return NextResponse.json({ students: group.students });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST: 單一新增學員 或 跨班加人
 * body: { account: string, name?: string, password?: string }
 * - 若只傳 account 且該帳號已存在：將該學員加入本班（跨班加人）
 * - 若傳 account + name + password：建立新學員並加入本班（單一新增）
 */
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
      const main = auth.teacherGroups?.some((g) => g.id === id);
      if (!main) return NextResponse.json({ error: '只能操作自己的班級' }, { status: 403 });
    }

    const body = await request.json();
    const { account, name, password } = body;
    if (!account || typeof account !== 'string') {
      return NextResponse.json({ error: '請提供 account' }, { status: 400 });
    }
    const normalizedAccount = normalizeAccountInput(account);
    const lookupKey = accountLookupKey(normalizedAccount);
    const looseMatched = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "users"
      WHERE REPLACE(UPPER("account"), '-', '') = ${lookupKey}
      LIMIT 1
    `;
    const existing = looseMatched[0]
      ? await prisma.user.findUnique({ where: { id: looseMatched[0].id } })
      : null;
    if (existing) {
      if (existing.role !== 'STUDENT') {
        return NextResponse.json({ error: '該帳號不是學員' }, { status: 400 });
      }
      if (existing.studentGroupId === id) {
        return NextResponse.json({ error: '該學員已在班級中' }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: existing.id },
        data: { studentGroupId: id },
      });
      return NextResponse.json({ success: true, action: 'joined', user: { id: existing.id, account: existing.account, name: existing.name ?? existing.account } });
    }

    if (!password) {
      return NextResponse.json({ error: '新學員請提供 password' }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(String(password), 10);
    const displayName = typeof name === 'string' && name.trim() ? name.trim() : null;
    const created = await prisma.user.create({
      data: {
        account: normalizedAccount,
        name: displayName,
        role: UserRole.STUDENT,
        schoolCode: group.schoolCode,
        passwordHash,
        studentGroupId: id,
      },
    });
    return NextResponse.json({ success: true, action: 'created', user: { id: created.id, account: created.account, name: created.name ?? created.account } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
