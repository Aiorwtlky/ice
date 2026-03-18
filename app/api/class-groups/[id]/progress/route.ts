import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

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
    const uid = payload.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, role: true, teacherGroups: { select: { id: true } } },
    });
    return user;
  } catch {
    return null;
  }
}

/** GET: 學員數據面板 - 全班學員在各遊戲的進度、求助次數、耗時、錯誤次數 */
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
    if (auth.role === 'TEACHER') {
      const main = auth.teacherGroups.some((g) => g.id === id);
      if (!main) return NextResponse.json({ error: '只能查看自己的班級' }, { status: 403 });
    }

    const authUser = await getAuth();
    if (authUser?.id) {
      await prisma.systemLog.create({
        data: { userId: authUser.id, classGroupId: id, action: 'VIEW_STUDENT_DATA' },
      });
    }

    const logs = await prisma.systemLog.findMany({
      where: { classGroupId: id },
      select: {
        userId: true,
        gameModuleId: true,
        action: true,
        isCorrect: true,
        timeDiffMs: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const group = await prisma.classGroup.findUnique({
      where: { id },
      select: { activeTermId: true },
    });
    if (!group) return NextResponse.json({ error: '找不到班級' }, { status: 404 });
    if (!group.activeTermId) return NextResponse.json({ error: '此班級尚未設定期數（activeTerm）' }, { status: 400 });
    const gameModules = await prisma.gameModule.findMany({
      where: { termId: group.activeTermId },
      select: { id: true, code: true, name: true },
    });

    const students = await prisma.user.findMany({
      where: { studentGroupId: id },
      select: { id: true, account: true, name: true },
    });

    const byUserGame: Record<string, Record<string, { help: number; success: boolean; timeMs: number; errors: number }>> = {};
    students.forEach((s) => {
      byUserGame[s.id] = {};
      gameModules.forEach((g) => {
        byUserGame[s.id][g.id] = { help: 0, success: false, timeMs: 0, errors: 0 };
      });
    });

    logs.forEach((log) => {
      if (!log.userId || !log.gameModuleId) return;
      const u = byUserGame[log.userId];
      const g = log.gameModuleId;
      if (!u || !u[g]) return;
      if (log.action === 'HELP') u[g].help += 1;
      if (log.action === 'SUCCESS') u[g].success = true;
      if (typeof log.timeDiffMs === 'number') u[g].timeMs += log.timeDiffMs;
      if (log.isCorrect === false) u[g].errors += 1;
    });

    const progress = students.map((s) => ({
      userId: s.id,
      account: s.account,
      name: s.name,
      games: gameModules.map((gm) => ({
        gameModuleId: gm.id,
        code: gm.code,
        name: gm.name,
        ...byUserGame[s.id]?.[gm.id],
      })),
    }));

    return NextResponse.json({ progress, gameModules });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
