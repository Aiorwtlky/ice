import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();

// JWT Secret Key（生產環境應該放在環境變數中）
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, password } = body;

    // 驗證輸入
    if (!account || !password) {
      return NextResponse.json(
        { error: '帳號和密碼為必填項目' },
        { status: 400 }
      );
    }

    const user = await withTimeout(
      prisma.user.findUnique({
        where: { account },
        include: {
          studentGroup: {
            include: { activeTerm: true },
          },
          teacherGroups: { include: { activeTerm: true } },
        },
      }),
      5000,
      'auth/login: prisma timeout'
    );

    if (!user) {
      return NextResponse.json(
        { error: '帳號或密碼錯誤' },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '帳號或密碼錯誤' },
        { status: 401 }
      );
    }

    // 學員：若該班級已鎖定「非上課時間禁止登入」，阻擋登入
    if (user.role === 'STUDENT' && user.studentGroup?.loginLocked) {
      return NextResponse.json(
        { error: '尚未開放登入' },
        { status: 403 }
      );
    }

    // 建立 JWT Token
    const token = await new SignJWT({
      userId: user.id,
      account: user.account,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d') // 7 天過期
      .sign(JWT_SECRET);

    // 回傳使用者資訊（排除 passwordHash），並在同一個 Response 上設定 HttpOnly Cookie
    const { passwordHash, ...userWithoutPassword } = user;

    const response = NextResponse.json({
      success: true,
      user: userWithoutPassword,
    });
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('登入錯誤:', error);
    const msg = error instanceof Error ? error.message : '';
    const hint = msg && (msg.includes('Unknown arg') || msg.includes('Invalid prisma') || msg.includes('P2002') || msg.includes('P2025'))
      ? ' 若剛修改過資料庫，請執行：npx prisma db push'
      : '';
    return NextResponse.json(
      { error: `伺服器錯誤，請稍後再試。${hint}` },
      { status: 500 }
    );
  }
}
