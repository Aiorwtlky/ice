import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser } from '@/lib/server-auth';

const prisma = new PrismaClient();

/** GET: 學生所屬班級、目前時段內可見的公告列表（回傳摘要） */
export async function GET() {
  const u = await getSessionUser();
  if (!u || u.role !== 'STUDENT' || !u.studentGroupId) {
    return NextResponse.json({ error: '未登入或非學員' }, { status: 403 });
  }

  const now = new Date();
  const rows = await prisma.classAnnouncement.findMany({
    where: {
      classGroupId: u.studentGroupId,
      visibleFrom: { lte: now },
      OR: [{ visibleUntil: null }, { visibleUntil: { gte: now } }],
    },
    orderBy: [{ isPinned: 'desc' }, { isImportant: 'desc' }, { visibleFrom: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      body: true,
      isPinned: true,
      isImportant: true,
      ctaLabel: true,
      ctaUrl: true,
      visibleFrom: true,
      visibleUntil: true,
      createdAt: true,
      reads: {
        where: { userId: u.id },
        select: { firstOpenedAt: true, lastOpenedAt: true, openCount: true },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    announcements: rows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.body.length > 180 ? `${r.body.slice(0, 180)}...` : r.body,
      isPinned: r.isPinned,
      isImportant: r.isImportant,
      ctaLabel: r.ctaLabel,
      ctaUrl: r.ctaUrl,
      visibleFrom: r.visibleFrom.toISOString(),
      visibleUntil: r.visibleUntil?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      myRead: r.reads[0]
        ? {
            firstOpenedAt: r.reads[0].firstOpenedAt.toISOString(),
            lastOpenedAt: r.reads[0].lastOpenedAt.toISOString(),
            openCount: r.reads[0].openCount,
          }
        : null,
    })),
  });
}
