import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';
import { assertStudentInClass, canManageClass, loadAuthTeacherGroups } from '@/app/api/class-competitions/_access';

const prisma = new PrismaClient();

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(prisma);
  if (!auth) return NextResponse.json({ error: '未授權' }, { status: 401 });
  const { id } = await ctx.params;

  const c = await prisma.classCompetition.findUnique({
    where: { id },
    select: { id: true, classGroupId: true },
  });
  if (!c) return NextResponse.json({ error: '找不到' }, { status: 404 });

  const teacherGroupIds = auth.role === 'TEACHER' ? await loadAuthTeacherGroups(prisma, auth.id) : [];

  if (auth.role === 'STUDENT') {
    if (!assertStudentInClass(auth, c.classGroupId)) {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }
  } else if (!canManageClass(auth, c.classGroupId, teacherGroupIds)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const scores = await prisma.classCompetitionScore.findMany({
    where: { competitionId: id },
    orderBy: [{ bestSteps: 'asc' }, { bestTimeMs: 'asc' }],
    include: {
      user: { select: { id: true, account: true, name: true } },
    },
  });

  const ranked = scores.map((s, idx) => ({
    rank: idx + 1,
    userId: s.userId,
    account: s.user.account,
    name: s.user.name,
    bestSteps: s.bestSteps,
    bestTimeMs: s.bestTimeMs,
    lastPlayedAt: s.lastPlayedAt.toISOString(),
    attemptCount: s.attemptCount,
  }));

  return NextResponse.json({ leaderboard: ranked });
}
