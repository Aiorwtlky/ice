import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser } from '@/lib/server-auth';

const prisma = new PrismaClient();

/** GET: 單一公告（學生、須在可見時段內） */
export async function GET(_req: unknown, context: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser();
  if (!u || u.role !== 'STUDENT' || !u.studentGroupId) {
    return NextResponse.json({ error: '未登入或非學員' }, { status: 403 });
  }
  const { id } = await context.params;
  const now = new Date();

  const ann = await prisma.classAnnouncement.findFirst({
    where: {
      id,
      classGroupId: u.studentGroupId,
      visibleFrom: { lte: now },
      OR: [{ visibleUntil: null }, { visibleUntil: { gte: now } }],
    },
    include: {
      reads: {
        where: { userId: u.id },
        take: 1,
      },
    },
  });
  if (!ann) return NextResponse.json({ error: '找不到公告或已過期' }, { status: 404 });

  const r = ann.reads[0];
  return NextResponse.json({
    announcement: {
      id: ann.id,
      title: ann.title,
      body: ann.body,
      visibleFrom: ann.visibleFrom.toISOString(),
      visibleUntil: ann.visibleUntil?.toISOString() ?? null,
      createdAt: ann.createdAt.toISOString(),
      myRead: r
        ? {
            firstOpenedAt: r.firstOpenedAt.toISOString(),
            lastOpenedAt: r.lastOpenedAt.toISOString(),
            openCount: r.openCount,
          }
        : null,
    },
  });
}
