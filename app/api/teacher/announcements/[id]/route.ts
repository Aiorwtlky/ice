import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser, canTeacherAccessClass } from '@/lib/server-auth';
import { logAnnouncementAction } from '@/lib/announcement-log';

const prisma = new PrismaClient();

function normalizeCta(input: { ctaLabel?: unknown; ctaUrl?: unknown }, fallback: { ctaLabel: string | null; ctaUrl: string | null }) {
  const rawLabel = input.ctaLabel;
  const rawUrl = input.ctaUrl;
  if (rawLabel === undefined && rawUrl === undefined) return fallback;

  const ctaLabel = typeof rawLabel === 'string' ? rawLabel.trim() : '';
  const ctaUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!ctaLabel && !ctaUrl) return { ctaLabel: null, ctaUrl: null };
  if (!ctaLabel || !ctaUrl) {
    throw new Error('連結標籤與連結網址需同時填寫');
  }
  if (!/^https?:\/\/\S+$/i.test(ctaUrl)) {
    throw new Error('連結網址格式錯誤，需以 http:// 或 https:// 開頭');
  }
  return { ctaLabel, ctaUrl };
}

async function getAnnouncementOr404(id: string) {
  return prisma.classAnnouncement.findUnique({
    where: { id },
    include: { classGroup: { select: { id: true, name: true } } },
  });
}

/** PATCH: 更新公告 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser();
  if (!u || (u.role !== 'TEACHER' && u.role !== 'ADMIN')) {
    return NextResponse.json({ error: '未登入或權限不足' }, { status: 403 });
  }
  const { id } = await context.params;
  const ann = await getAnnouncementOr404(id);
  if (!ann) return NextResponse.json({ error: '找不到公告' }, { status: 404 });
  if (!canTeacherAccessClass(u, ann.classGroupId)) {
    return NextResponse.json({ error: '無權限操作此班級' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim() : ann.title;
  const textBody = typeof body.body === 'string' ? body.body : ann.body;
  const isPinned = typeof body.isPinned === 'boolean' ? body.isPinned : ann.isPinned;
  const isImportant = typeof body.isImportant === 'boolean' ? body.isImportant : ann.isImportant;
  if (!title || !textBody) {
    return NextResponse.json({ error: '主旨與內文必填' }, { status: 400 });
  }
  if (title.length > 200 || textBody.length > 20000) {
    return NextResponse.json({ error: '主旨或內文過長' }, { status: 400 });
  }

  let visibleFrom = ann.visibleFrom;
  if (typeof body.visibleFrom === 'string' && body.visibleFrom) {
    const d = new Date(body.visibleFrom);
    if (!Number.isNaN(d.getTime())) visibleFrom = d;
  }
  let visibleUntil: Date | null = ann.visibleUntil;
  if (body.visibleUntil === null) visibleUntil = null;
  else if (typeof body.visibleUntil === 'string' && body.visibleUntil) {
    const d = new Date(body.visibleUntil);
    if (!Number.isNaN(d.getTime())) visibleUntil = d;
  }

  let ctaLabel: string | null = ann.ctaLabel;
  let ctaUrl: string | null = ann.ctaUrl;
  try {
    const cta = normalizeCta(body as { ctaLabel?: unknown; ctaUrl?: unknown }, {
      ctaLabel: ann.ctaLabel,
      ctaUrl: ann.ctaUrl,
    });
    ctaLabel = cta.ctaLabel;
    ctaUrl = cta.ctaUrl;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '連結設定錯誤' }, { status: 400 });
  }

  const updated = await prisma.classAnnouncement.update({
    where: { id },
    data: { title, body: textBody, isPinned, isImportant, ctaLabel, ctaUrl, visibleFrom, visibleUntil },
  });

  await logAnnouncementAction({
    userId: u.id,
    classGroupId: ann.classGroupId,
    action: 'ANNOUNCEMENT_UPDATE',
    payload: {
      announcementId: id,
      title: updated.title,
      isPinned: updated.isPinned,
      isImportant: updated.isImportant,
      ctaLabel: updated.ctaLabel,
      ctaUrl: updated.ctaUrl,
      visibleFrom: updated.visibleFrom.toISOString(),
      visibleUntil: updated.visibleUntil?.toISOString() ?? null,
    },
  });

  return NextResponse.json({
    announcement: {
      id: updated.id,
      title: updated.title,
      body: updated.body,
      isPinned: updated.isPinned,
      isImportant: updated.isImportant,
      ctaLabel: updated.ctaLabel,
      ctaUrl: updated.ctaUrl,
      visibleFrom: updated.visibleFrom.toISOString(),
      visibleUntil: updated.visibleUntil?.toISOString() ?? null,
    },
  });
}

/** DELETE */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser();
  if (!u || (u.role !== 'TEACHER' && u.role !== 'ADMIN')) {
    return NextResponse.json({ error: '未登入或權限不足' }, { status: 403 });
  }
  const { id } = await context.params;
  const ann = await getAnnouncementOr404(id);
  if (!ann) return NextResponse.json({ error: '找不到公告' }, { status: 404 });
  if (!canTeacherAccessClass(u, ann.classGroupId)) {
    return NextResponse.json({ error: '無權限操作此班級' }, { status: 403 });
  }

  await prisma.classAnnouncement.delete({ where: { id } });

  await logAnnouncementAction({
    userId: u.id,
    classGroupId: ann.classGroupId,
    action: 'ANNOUNCEMENT_DELETE',
    payload: { announcementId: id, title: ann.title },
  });

  return NextResponse.json({ success: true });
}
