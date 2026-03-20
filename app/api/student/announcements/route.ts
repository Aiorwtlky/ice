import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser } from '@/lib/server-auth';

const prisma = new PrismaClient();

/** GET: 學生所屬班級、目前時段內可見的公告（不含全文過長時仍回傳 body 於列表—可改只回摘要） */
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
    orderBy: [{ visibleFrom: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      body: true,
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
      body: r.body,
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
