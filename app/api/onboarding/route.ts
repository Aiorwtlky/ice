import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

/** 學員首次登入：填寫性別、年級，寫入後不再顯示 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, onboardingDone: true },
    });
    if (!user || user.role !== 'STUDENT') {
      return NextResponse.json({ error: '僅學員可填寫' }, { status: 403 });
    }
    if (user.onboardingDone) {
      return NextResponse.json({ success: true, alreadyDone: true });
    }

    const body = await request.json();
    const { gender, grade } = body;
    const allowedGenders = ['男生', '女生'];
    const allowedGrades = ['三年級', '四年級', '五年級', '六年級'];
    if (!allowedGenders.includes(gender) || !allowedGrades.includes(grade)) {
      return NextResponse.json(
        { error: '請選擇性別（男生/女生）與年級（三年級～六年級）' },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { gender, grade, onboardingDone: true },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
