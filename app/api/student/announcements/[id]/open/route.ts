import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser } from '@/lib/server-auth';
import { logAnnouncementAction, logAnnouncementLearning } from '@/lib/announcement-log';

const prisma = new PrismaClient();

/** POST: 學生開啟公告（記錄首次／再次開啟時間，寫入 system + learning log） */
export async function POST(_req: unknown, context: { params: Promise<{ id: string }> }) {
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
  });
  if (!ann) {
    return NextResponse.json({ error: '找不到公告或已過期' }, { status: 404 });
  }

  const openedAtMs = Date.now();
  const existing = await prisma.announcementRead.findUnique({
    where: { announcementId_userId: { announcementId: id, userId: u.id } },
  });

  let firstOpenedAt: string;
  let lastOpenedAt: string;
  let openCount: number;
  let isFirstOpen: boolean;

  if (existing) {
    const updated = await prisma.announcementRead.update({
      where: { id: existing.id },
      data: {
        lastOpenedAt: new Date(openedAtMs),
        openCount: { increment: 1 },
      },
    });
    firstOpenedAt = existing.firstOpenedAt.toISOString();
    lastOpenedAt = updated.lastOpenedAt.toISOString();
    openCount = updated.openCount;
    isFirstOpen = false;
  } else {
    const created = await prisma.announcementRead.create({
      data: {
        announcementId: id,
        userId: u.id,
        firstOpenedAt: new Date(openedAtMs),
        lastOpenedAt: new Date(openedAtMs),
        openCount: 1,
      },
    });
    firstOpenedAt = created.firstOpenedAt.toISOString();
    lastOpenedAt = created.lastOpenedAt.toISOString();
    openCount = created.openCount;
    isFirstOpen = true;
  }

  const payload = {
    announcementId: id,
    title: ann.title,
    openedAtMs,
    firstOpenedAt,
    lastOpenedAt,
    openCount,
    isFirstOpen,
  };

  await logAnnouncementAction({
    userId: u.id,
    classGroupId: u.studentGroupId,
    action: 'ANNOUNCEMENT_OPEN',
    payload,
  });

  await logAnnouncementLearning({
    userId: u.id,
    actionType: 'ANNOUNCEMENT_OPEN',
    detail: payload,
  });

  return NextResponse.json({
    success: true,
    firstOpenedAt,
    lastOpenedAt,
    openCount,
    isFirstOpen,
  });
}
