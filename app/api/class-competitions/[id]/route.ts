import { NextResponse } from 'next/server';
import { PrismaClient, CompetitionStatus } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';
import { assertStudentInClass, canManageClass, loadAuthTeacherGroups } from '@/app/api/class-competitions/_access';
import { getRemainingTimeMs } from '@/lib/class-competition';

const prisma = new PrismaClient();

async function getCompetition(id: string) {
  return prisma.classCompetition.findUnique({
    where: { id },
    include: { classGroup: { select: { id: true, name: true } } },
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(prisma);
  if (!auth) return NextResponse.json({ error: '未授權' }, { status: 401 });
  const { id } = await ctx.params;
  const c = await getCompetition(id);
  if (!c) return NextResponse.json({ error: '找不到' }, { status: 404 });

  const teacherGroupIds = auth.role === 'TEACHER' ? await loadAuthTeacherGroups(prisma, auth.id) : [];

  if (auth.role === 'STUDENT') {
    if (!assertStudentInClass(auth, c.classGroupId)) {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }
  } else if (!canManageClass(auth, c.classGroupId, teacherGroupIds)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const now = Date.now();
  const remainingTimeMs =
    c.mode === 'TIME_LIMIT' && c.timeLimitSec != null
      ? getRemainingTimeMs(
          {
            status: c.status,
            openedAt: c.openedAt,
            pauseStartedAt: c.pauseStartedAt,
            totalPausedMs: c.totalPausedMs,
            timeLimitSec: c.timeLimitSec,
          },
          now
        )
      : null;

  let myScore = null as null | {
    bestSteps: number;
    bestTimeMs: number | null;
    attemptCount: number;
    lastPlayedAt: string;
  };
  if (auth.role === 'STUDENT') {
    const row = await prisma.classCompetitionScore.findUnique({
      where: { competitionId_userId: { competitionId: id, userId: auth.id } },
    });
    if (row) {
      myScore = {
        bestSteps: row.bestSteps,
        bestTimeMs: row.bestTimeMs,
        attemptCount: row.attemptCount,
        lastPlayedAt: row.lastPlayedAt.toISOString(),
      };
    }
  }

  /** 暫停時不可進入遊玩；僅 OPEN 且未逾時可玩 */
  const canPlay =
    auth.role === 'STUDENT' &&
    c.status === 'OPEN' &&
    (c.mode !== 'TIME_LIMIT' || remainingTimeMs === null || remainingTimeMs > 0);

  return NextResponse.json({
    competition: {
      id: c.id,
      classGroupId: c.classGroupId,
      classGroupName: c.classGroup.name,
      name: c.name,
      kind: c.kind,
      mode: c.mode,
      status: c.status,
      discCount: c.discCount,
      timeLimitSec: c.timeLimitSec,
      moveLimit: c.moveLimit,
      rulesText: c.rulesText,
      openedAt: c.openedAt?.toISOString() ?? null,
      endedAt: c.endedAt?.toISOString() ?? null,
      pauseStartedAt: c.pauseStartedAt?.toISOString() ?? null,
      totalPausedMs: c.totalPausedMs,
    },
    serverNow: new Date(now).toISOString(),
    remainingTimeMs,
    myScore,
    canPlay,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(prisma);
  if (!auth) return NextResponse.json({ error: '未授權' }, { status: 401 });
  if (auth.role !== 'TEACHER' && auth.role !== 'ADMIN') {
    return NextResponse.json({ error: '僅老師或管理員' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const c = await getCompetition(id);
  if (!c) return NextResponse.json({ error: '找不到' }, { status: 404 });

  const teacherGroupIds = auth.role === 'TEACHER' ? await loadAuthTeacherGroups(prisma, auth.id) : [];
  if (!canManageClass(auth, c.classGroupId, teacherGroupIds)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON 無效' }, { status: 400 });
  }

  const status = body.status as CompetitionStatus | undefined;
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  const rulesText = body.rulesText !== undefined ? (typeof body.rulesText === 'string' ? body.rulesText : null) : undefined;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    if (!name) return NextResponse.json({ error: '名稱不可空白' }, { status: 400 });
    updates.name = name;
  }
  if (rulesText !== undefined) updates.rulesText = rulesText;

  if (status) {
    const now = new Date();
    if (status === CompetitionStatus.OPEN) {
      if (c.status === CompetitionStatus.DRAFT) {
        updates.status = CompetitionStatus.OPEN;
        updates.openedAt = now;
        updates.pauseStartedAt = null;
      } else if (c.status === CompetitionStatus.PAUSED) {
        if (c.pauseStartedAt) {
          const delta = now.getTime() - c.pauseStartedAt.getTime();
          updates.totalPausedMs = c.totalPausedMs + delta;
        }
        updates.status = CompetitionStatus.OPEN;
        updates.pauseStartedAt = null;
      } else {
        return NextResponse.json({ error: '無法從目前狀態開放' }, { status: 400 });
      }
    } else if (status === CompetitionStatus.PAUSED) {
      if (c.status !== CompetitionStatus.OPEN) {
        return NextResponse.json({ error: '僅進行中可暫停' }, { status: 400 });
      }
      updates.status = CompetitionStatus.PAUSED;
      updates.pauseStartedAt = now;
    } else if (status === CompetitionStatus.ENDED) {
      updates.status = CompetitionStatus.ENDED;
      updates.endedAt = now;
      updates.pauseStartedAt = null;
    } else if (status === CompetitionStatus.DRAFT) {
      if (c.status !== CompetitionStatus.DRAFT) {
        return NextResponse.json({ error: '已開放過的比賽不可改回草稿' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: '無效的 status' }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ competition: c });
  }

  const updated = await prisma.classCompetition.update({
    where: { id },
    data: updates as Parameters<typeof prisma.classCompetition.update>[0]['data'],
  });

  await prisma.classCompetitionLog.create({
    data: {
      competitionId: id,
      userId: auth.id,
      action: 'COMPETITION_STATUS',
      payload: {
        patch: body,
        result: {
          status: updated.status,
          openedAt: updated.openedAt,
          pauseStartedAt: updated.pauseStartedAt,
          totalPausedMs: updated.totalPausedMs,
          endedAt: updated.endedAt,
        },
      } as object,
    },
  });

  return NextResponse.json({ competition: updated });
}
