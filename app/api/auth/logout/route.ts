import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('auth-token');

    return NextResponse.json({
      success: true,
      message: '已登出',
    });
  } catch (error) {
    console.error('登出錯誤:', error);
    return NextResponse.json(
      { error: '登出失敗' },
      { status: 500 }
    );
  }
}
