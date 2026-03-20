import { NextResponse } from 'next/server';
import { PrismaClient, CompetitionMode, CompetitionStatus } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';
import { assertStudentInClass } from '@/app/api/class-competitions/_access';
import { getActiveElapsedMs } from '@/lib/class-competition';

const prisma = new PrismaClient();

function optimalSteps(n: number) {
  return 2 ** n - 1;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(prisma);
  if (!auth) return NextResponse.json({ error: '未授權' }, { status: 401 });
  if (auth.role !== 'STUDENT') return NextResponse.json({ error: '僅學生可提交' }, { status: 403 });

  const { id } = await ctx.params;
  const c = await prisma.classCompetition.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: '找不到' }, { status: 404 });
  if (!assertStudentInClass(auth, c.classGroupId)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }
  if (c.status !== CompetitionStatus.OPEN) {
    return NextResponse.json({ error: '比賽未開放或已暫停／結束' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON 無效' }, { status: 400 });
  }

  const steps = typeof body.steps === 'number' ? body.steps : NaN;
  const timeMs = typeof body.timeMs === 'number' ? body.timeMs : null;
  if (!Number.isInteger(steps) || steps < optimalSteps(c.discCount)) {
    return NextResponse.json({ error: '步數無效或未達最少步數' }, { status: 400 });
  }

  const nowMs = Date.now();

  if (c.mode === CompetitionMode.TIME_LIMIT && c.timeLimitSec != null) {
    const used = getActiveElapsedMs(
      {
        status: c.status,
        openedAt: c.openedAt,
        pauseStartedAt: c.pauseStartedAt,
        totalPausedMs: c.totalPausedMs,
        timeLimitSec: c.timeLimitSec,
      },
      nowMs
    );
    if (used > c.timeLimitSec * 1000 + 500) {
      return NextResponse.json({ error: '已超過限時' }, { status: 400 });
    }
  }

  if (c.mode === CompetitionMode.MOVE_LIMIT && c.moveLimit != null && steps > c.moveLimit) {
    return NextResponse.json({ error: '超過計次設定' }, { status: 400 });
  }

  const existing = await prisma.classCompetitionScore.findUnique({
    where: { competitionId_userId: { competitionId: id, userId: auth.id } },
  });

  let improved = false;
  if (!existing) {
    improved = true;
    await prisma.classCompetitionScore.create({
      data: {
        competitionId: id,
        userId: auth.id,
        bestSteps: steps,
        bestTimeMs: timeMs,
        attemptCount: 1,
        detail: { firstSubmit: true } as object,
      },
    });
  } else {
    const betterSteps = steps < existing.bestSteps;
    const sameStepsFaster = steps === existing.bestSteps && (timeMs != null && (existing.bestTimeMs == null || timeMs < existing.bestTimeMs));
    if (betterSteps || sameStepsFaster) {
      improved = true;
      await prisma.classCompetitionScore.update({
        where: { competitionId_userId: { competitionId: id, userId: auth.id } },
        data: {
          bestSteps: steps,
          bestTimeMs: timeMs ?? existing.bestTimeMs,
          attemptCount: { increment: 1 },
          lastPlayedAt: new Date(),
          detail: {
            prevBestSteps: existing.bestSteps,
            prevBestTimeMs: existing.bestTimeMs,
          } as object,
        },
      });
    } else {
      await prisma.classCompetitionScore.update({
        where: { competitionId_userId: { competitionId: id, userId: auth.id } },
        data: {
          attemptCount: { increment: 1 },
          lastPlayedAt: new Date(),
        },
      });
    }
  }

  await prisma.classCompetitionLog.create({
    data: {
      competitionId: id,
      userId: auth.id,
      action: 'SUBMIT_RESULT',
      isCorrect: true,
      payload: {
        steps,
        timeMs,
        improved,
        discCount: c.discCount,
        optimal: optimalSteps(c.discCount),
        mode: c.mode,
      } as object,
    },
  });

  return NextResponse.json({ ok: true, improved });
}
