import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser, canTeacherAccessClass } from '@/lib/server-auth';
import { logAnnouncementAction } from '@/lib/announcement-log';

const prisma = new PrismaClient();

function normalizeCta(input: { ctaLabel?: unknown; ctaUrl?: unknown }) {
  const ctaLabel = typeof input.ctaLabel === 'string' ? input.ctaLabel.trim() : '';
  const ctaUrl = typeof input.ctaUrl === 'string' ? input.ctaUrl.trim() : '';
  if (!ctaLabel && !ctaUrl) return { ctaLabel: null as string | null, ctaUrl: null as string | null };
  if (!ctaLabel || !ctaUrl) {
    throw new Error('連結標籤與連結網址需同時填寫');
  }
  if (!/^https?:\/\/\S+$/i.test(ctaUrl)) {
    throw new Error('連結網址格式錯誤，需以 http:// 或 https:// 開頭');
  }
  return { ctaLabel, ctaUrl };
}

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
    orderBy: [{ isPinned: 'desc' }, { isImportant: 'desc' }, { visibleFrom: 'desc' }, { createdAt: 'desc' }],
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
      isPinned: r.isPinned,
      isImportant: r.isImportant,
      ctaLabel: r.ctaLabel,
      ctaUrl: r.ctaUrl,
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
  const isPinned = Boolean(body.isPinned);
  const isImportant = Boolean(body.isImportant);
  if (!classGroupId || !title || !textBody) {
    return NextResponse.json({ error: '請提供 classGroupId、主旨、內文' }, { status: 400 });
  }
  if (title.length > 200 || textBody.length > 20000) {
    return NextResponse.json({ error: '主旨或內文過長' }, { status: 400 });
  }
  if (!canTeacherAccessClass(u, classGroupId)) {
    return NextResponse.json({ error: '無權限操作此班級' }, { status: 403 });
  }

  let ctaLabel: string | null = null;
  let ctaUrl: string | null = null;
  try {
    const cta = normalizeCta(body as { ctaLabel?: unknown; ctaUrl?: unknown });
    ctaLabel = cta.ctaLabel;
    ctaUrl = cta.ctaUrl;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '連結設定錯誤' }, { status: 400 });
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
      isPinned,
      isImportant,
      ctaLabel,
      ctaUrl,
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
      isPinned: created.isPinned,
      isImportant: created.isImportant,
      ctaLabel: created.ctaLabel,
      ctaUrl: created.ctaUrl,
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
