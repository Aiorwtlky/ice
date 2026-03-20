import { NextResponse } from 'next/server';
import { PrismaClient, CompetitionKind, CompetitionMode, CompetitionStatus } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';
import { canManageClass, loadAuthTeacherGroups } from '@/app/api/class-competitions/_access';

const prisma = new PrismaClient();

function parsePositiveInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export async function GET(req: Request) {
  const auth = await getAuthUser(prisma);
  if (!auth) return NextResponse.json({ error: '未授權' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classGroupIdParam = searchParams.get('classGroupId');

  if (auth.role === 'STUDENT') {
    const cg = auth.studentGroupId;
    if (!cg) return NextResponse.json({ error: '未分班級' }, { status: 403 });
    const list = await prisma.classCompetition.findMany({
      where: {
        classGroupId: cg,
        status: { in: [CompetitionStatus.OPEN, CompetitionStatus.PAUSED, CompetitionStatus.ENDED] },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        kind: true,
        mode: true,
        status: true,
        discCount: true,
        timeLimitSec: true,
        moveLimit: true,
        openedAt: true,
        endedAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ competitions: list });
  }

  const teacherGroupIds = auth.role === 'TEACHER' ? await loadAuthTeacherGroups(prisma, auth.id) : [];
  const classGroupId = classGroupIdParam ?? '';
  if (!classGroupId) {
    return NextResponse.json({ error: '請提供 classGroupId' }, { status: 400 });
  }
  if (!canManageClass(auth, classGroupId, teacherGroupIds)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const list = await prisma.classCompetition.findMany({
    where: { classGroupId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { scores: true, logs: true } },
    },
  });
  return NextResponse.json({ competitions: list });
}

export async function POST(req: Request) {
  const auth = await getAuthUser(prisma);
  if (!auth) return NextResponse.json({ error: '未授權' }, { status: 401 });

  const teacherGroupIds = auth.role === 'TEACHER' ? await loadAuthTeacherGroups(prisma, auth.id) : [];
  if (auth.role !== 'TEACHER' && auth.role !== 'ADMIN') {
    return NextResponse.json({ error: '僅老師或管理員可建立' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON 無效' }, { status: 400 });
  }

  const classGroupId = typeof body.classGroupId === 'string' ? body.classGroupId : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const modeStr = typeof body.mode === 'string' ? body.mode.trim() : '';
  const mode =
    modeStr === 'TIME_LIMIT'
      ? CompetitionMode.TIME_LIMIT
      : modeStr === 'MOVE_LIMIT'
        ? CompetitionMode.MOVE_LIMIT
        : null;

  const discRaw = parsePositiveInt(body.discCount);
  const discCount = discRaw ?? NaN;

  const timeRaw =
    body.timeLimitSec === undefined || body.timeLimitSec === null
      ? null
      : parsePositiveInt(body.timeLimitSec);
  const timeLimitSec = timeRaw;

  const rulesText =
    typeof body.rulesText === 'string'
      ? body.rulesText.trim() === ''
        ? null
        : body.rulesText.trim()
      : null;

  if (!classGroupId || !name) {
    return NextResponse.json({ error: 'classGroupId 與 name 必填' }, { status: 400 });
  }
  if (!canManageClass(auth, classGroupId, teacherGroupIds)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }
  if (!mode) {
    return NextResponse.json({ error: 'mode 須為 TIME_LIMIT（限時）或 MOVE_LIMIT（計次）' }, { status: 400 });
  }
  if (discCount < 3 || discCount > 10 || !Number.isInteger(discCount)) {
    return NextResponse.json({ error: 'discCount 須為 3–10 的整數' }, { status: 400 });
  }
  if (mode === CompetitionMode.TIME_LIMIT) {
    if (timeLimitSec == null || timeLimitSec < 30 || timeLimitSec > 86400) {
      return NextResponse.json({ error: '限時模式：timeLimitSec 須為 30–86400 秒' }, { status: 400 });
    }
  }

  try {
    const created = await prisma.classCompetition.create({
      data: {
        classGroupId,
        name,
        kind: CompetitionKind.HANOI_TOWER,
        mode,
        status: CompetitionStatus.DRAFT,
        discCount,
        timeLimitSec: mode === CompetitionMode.TIME_LIMIT ? timeLimitSec : null,
        // 計次模式：不設步數上限，僅以完成步數排名；欄位保留相容舊資料
        moveLimit: null,
        rulesText,
        createdById: auth.id,
      },
    });

    await prisma.classCompetitionLog.create({
      data: {
        competitionId: created.id,
        userId: auth.id,
        action: 'COMPETITION_CREATE',
        payload: {
          name,
          mode,
          discCount,
          timeLimitSec: created.timeLimitSec,
          moveLimit: created.moveLimit,
          classGroupId,
        } as object,
      },
    });

    return NextResponse.json({ competition: created });
  } catch (err) {
    console.error('[class-competitions POST]', err);
    const msg = err instanceof Error ? err.message : '資料庫寫入失敗';
    return NextResponse.json({ error: `建立失敗：${msg}` }, { status: 500 });
  }
}
