import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const user = await getAuthUser(prisma);
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const terms = await prisma.term.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ terms });
  } catch (error) {
    console.error('GET /api/activity-categories:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
