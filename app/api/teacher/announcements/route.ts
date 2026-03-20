import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser, canTeacherAccessClass } from '@/lib/server-auth';
import { logAnnouncementAction } from '@/lib/announcement-log';

const prisma = new PrismaClient();

/** GET: ?classGroupId= 該班公告列表（老師／管理員） */
export async function GET(req: NextRequest) {
  const u = await getSessionUser();
  if (!u || (u.role !== 'TEACHER' && u.role !== 'ADMIN')) {
    return NextResponse.json({ error: '未登入或權限不足' }, { status: 403 });
  }
  const classGroupId = req.nextUrl.searchParams.get('classGroupId');
  if (!classGroupId) {
    return NextResponse.json({ error: '請提供 classGroupId' }, { status: 400 });
  }
  if (!canTeacherAccessClass(u, classGroupId)) {
    return NextResponse.json({ error: '無權限操作此班級' }, { status: 403 });
  }

  const rows = await prisma.classAnnouncement.findMany({
    where: { classGroupId },
    orderBy: [{ visibleFrom: 'desc' }, { createdAt: 'desc' }],
    include: {
      createdBy: { select: { id: true, account: true, name: true } },
      _count: { select: { reads: true } },
    },
  });

  return NextResponse.json({
    announcements: rows.map((r) => ({
      id: r.id,
      classGroupId: r.classGroupId,
      title: r.title,
      body: r.body,
      visibleFrom: r.visibleFrom.toISOString(),
      visibleUntil: r.visibleUntil?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      createdBy: r.createdBy,
      readCount: r._count.reads,
    })),
  });
}

/** POST: 建立公告（限該班負責老師；管理員亦可） */
export async function POST(req: NextRequest) {
  const u = await getSessionUser();
  if (!u || (u.role !== 'TEACHER' && u.role !== 'ADMIN')) {
    return NextResponse.json({ error: '未登入或權限不足' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const classGroupId = typeof body.classGroupId === 'string' ? body.classGroupId : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const textBody = typeof body.body === 'string' ? body.body : '';
  if (!classGroupId || !title || !textBody) {
    return NextResponse.json({ error: '請提供 classGroupId、主旨、內文' }, { status: 400 });
  }
  if (title.length > 200 || textBody.length > 20000) {
    return NextResponse.json({ error: '主旨或內文過長' }, { status: 400 });
  }
  if (!canTeacherAccessClass(u, classGroupId)) {
    return NextResponse.json({ error: '無權限操作此班級' }, { status: 403 });
  }

  let visibleFrom = new Date();
  if (typeof body.visibleFrom === 'string' && body.visibleFrom) {
    const d = new Date(body.visibleFrom);
    if (!Number.isNaN(d.getTime())) visibleFrom = d;
  }
  let visibleUntil: Date | null = null;
  if (typeof body.visibleUntil === 'string' && body.visibleUntil) {
    const d = new Date(body.visibleUntil);
    if (!Number.isNaN(d.getTime())) visibleUntil = d;
  }

  const created = await prisma.classAnnouncement.create({
    data: {
      classGroupId,
      title,
      body: textBody,
      createdById: u.id,
      visibleFrom,
      visibleUntil,
    },
  });

  await logAnnouncementAction({
    userId: u.id,
    classGroupId,
    action: 'ANNOUNCEMENT_CREATE',
    payload: {
      announcementId: created.id,
      title: created.title,
      visibleFrom: created.visibleFrom.toISOString(),
      visibleUntil: created.visibleUntil?.toISOString() ?? null,
    },
  });

  return NextResponse.json({
    announcement: {
      id: created.id,
      classGroupId: created.classGroupId,
      title: created.title,
      body: created.body,
      visibleFrom: created.visibleFrom.toISOString(),
      visibleUntil: created.visibleUntil?.toISOString() ?? null,
      createdAt: created.createdAt.toISOString(),
    },
  });
}
