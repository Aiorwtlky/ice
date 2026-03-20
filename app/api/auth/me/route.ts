import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: '未登入' },
        { status: 401 }
      );
    }

    // 驗證 JWT Token
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;

    // 查詢使用者資訊
    const user = await withTimeout(
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          studentGroup: {
            include: {
              activeTerm: true,
            },
          },
          teacherGroups: {
            include: {
              activeTerm: true,
            },
          },
        },
      }),
      5000,
      'auth/me: prisma timeout'
    );

    if (!user) {
      return NextResponse.json(
        { error: '使用者不存在' },
        { status: 404 }
      );
    }

    // 學員：若該班級已鎖定，直接視為登出（避免學生持續用舊 token 停留在站內）
    if (user.role === 'STUDENT' && user.studentGroup?.loginLocked) {
      const res = NextResponse.json({ error: '尚未開放登入' }, { status: 403 });
      res.cookies.delete('auth-token');
      return res;
    }

    // 排除 passwordHash
    const { passwordHash, ...userWithoutPassword } = user;

    return NextResponse.json({
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('驗證錯誤:', error);
    return NextResponse.json(
      { error: 'Token 無效或已過期' },
      { status: 401 }
    );
  }
}
