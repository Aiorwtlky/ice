import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser } from '@/lib/server-auth';
const prisma = new PrismaClient();

/** GET: 管理員檢視全部公告（含班級名稱） */
export async function GET() {
  const u = await getSessionUser();
  if (!u || u.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const rows = await prisma.classAnnouncement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: {
      classGroup: { select: { id: true, name: true, schoolCode: true } },
      createdBy: { select: { id: true, account: true, name: true } },
      _count: { select: { reads: true } },
    },
  });

  return NextResponse.json({
    announcements: rows.map((r) => ({
      id: r.id,
      classGroupId: r.classGroupId,
      classGroup: r.classGroup,
      title: r.title,
      body: r.body,
      visibleFrom: r.visibleFrom.toISOString(),
      visibleUntil: r.visibleUntil?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy,
      readCount: r._count.reads,
    })),
  });
}
