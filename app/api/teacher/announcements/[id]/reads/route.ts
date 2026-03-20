import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser, canTeacherAccessClass } from '@/lib/server-auth';
const prisma = new PrismaClient();

/** GET: 已讀學生與時間（老師／管理員） */
export async function GET(_req: unknown, context: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser();
  if (!u || (u.role !== 'TEACHER' && u.role !== 'ADMIN')) {
    return NextResponse.json({ error: '未登入或權限不足' }, { status: 403 });
  }
  const { id } = await context.params;
  const ann = await prisma.classAnnouncement.findUnique({ where: { id } });
  if (!ann) return NextResponse.json({ error: '找不到公告' }, { status: 404 });
  if (!canTeacherAccessClass(u, ann.classGroupId)) {
    return NextResponse.json({ error: '無權限操作此班級' }, { status: 403 });
  }

  const reads = await prisma.announcementRead.findMany({
    where: { announcementId: id },
    orderBy: { firstOpenedAt: 'asc' },
    include: { user: { select: { id: true, account: true, name: true } } },
  });

  return NextResponse.json({
    reads: reads.map((r) => ({
      userId: r.userId,
      account: r.user.account,
      name: r.user.name,
      firstOpenedAt: r.firstOpenedAt.toISOString(),
      lastOpenedAt: r.lastOpenedAt.toISOString(),
      openCount: r.openCount,
    })),
  });
}
