import { NextResponse } from 'next/server';
import { Prisma, PrismaClient } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';
import { assertStudentInClass, canManageClass, loadAuthTeacherGroups } from '@/app/api/class-competitions/_access';

const prisma = new PrismaClient();

/** 學生寫入詳細 JSON log */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(prisma);
  if (!auth) return NextResponse.json({ error: '未授權' }, { status: 401 });
  if (auth.role !== 'STUDENT') return NextResponse.json({ error: '僅學生可寫入遊戲 log' }, { status: 403 });

  const { id } = await ctx.params;
  const c = await prisma.classCompetition.findUnique({
    where: { id },
    select: { classGroupId: true, status: true },
  });
  if (!c) return NextResponse.json({ error: '找不到' }, { status: 404 });
  if (!assertStudentInClass(auth, c.classGroupId)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON 無效' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action : '';
  if (!action) return NextResponse.json({ error: 'action 必填' }, { status: 400 });

  const payload = (body.payload && typeof body.payload === 'object' ? body.payload : {}) as Prisma.InputJsonValue;
  const timeDiffMs = typeof body.timeDiffMs === 'number' ? body.timeDiffMs : null;
  const isCorrect = typeof body.isCorrect === 'boolean' ? body.isCorrect : null;

  const log = await prisma.classCompetitionLog.create({
    data: {
      competitionId: id,
      userId: auth.id,
      action,
      payload,
      timeDiffMs: timeDiffMs ?? undefined,
      isCorrect: isCorrect ?? undefined,
    },
  });

  return NextResponse.json({
    ok: true,
    log: {
      id: log.id,
      action: log.action,
      createdAt: log.createdAt.toISOString(),
    },
  });
}

/** 老師／管理員檢視 log */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(prisma);
  if (!auth) return NextResponse.json({ error: '未授權' }, { status: 401 });
  if (auth.role !== 'TEACHER' && auth.role !== 'ADMIN') {
    return NextResponse.json({ error: '僅老師或管理員' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const c = await prisma.classCompetition.findUnique({
    where: { id },
    select: { classGroupId: true },
  });
  if (!c) return NextResponse.json({ error: '找不到' }, { status: 404 });

  const teacherGroupIds = auth.role === 'TEACHER' ? await loadAuthTeacherGroups(prisma, auth.id) : [];
  if (!canManageClass(auth, c.classGroupId, teacherGroupIds)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 100));
  const userId = searchParams.get('userId') || undefined;

  const logs = await prisma.classCompetitionLog.findMany({
    where: { competitionId: id, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { account: true, name: true } },
    },
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      payload: l.payload,
      timeDiffMs: l.timeDiffMs,
      isCorrect: l.isCorrect,
      createdAt: l.createdAt.toISOString(),
      user: l.user,
    })),
  });
}
