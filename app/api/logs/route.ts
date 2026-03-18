import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

/** 從 Cookie 取得 userId、classGroupId（學員所屬班級或老師第一個班級） */
async function getAuthContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        studentGroupId: true,
        teacherGroups: { take: 1, select: { id: true } },
      },
    });
    if (!user) return null;
    const classGroupId =
      user.studentGroupId ?? user.teacherGroups[0]?.id ?? null;
    return { userId: user.id, classGroupId };
  } catch {
    return null;
  }
}

/**
 * POST：寫入一筆操作日誌（論文與分析用）
 * body: {
 *   action: string,           // START | MOVE | HELP | ERROR | SUCCESS | TAB_LEAVE | TAB_ENTER | PING | UNLOCK_TASK | VIEW_STUDENT_DATA
 *   isCorrect?: boolean,
 *   timeDiffMs?: number,
 *   sessionId?: string,
 *   gameModuleId?: string,
 *   payload?: object          // 任意 JSON：按鈕 id、河內塔 fromRod/toRod/disc、raw_data 等
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const body = await request.json();
    const {
      action,
      isCorrect,
      timeDiffMs,
      sessionId,
      gameModuleId,
      payload,
    } = body;

    if (typeof action !== 'string' || !action.trim()) {
      return NextResponse.json(
        { error: '請提供 action (string)' },
        { status: 400 }
      );
    }

    const log = await prisma.systemLog.create({
      data: {
        userId: auth.userId,
        classGroupId: auth.classGroupId ?? undefined,
        sessionId: typeof sessionId === 'string' ? sessionId : undefined,
        gameModuleId: typeof gameModuleId === 'string' ? gameModuleId : undefined,
        action: action.trim(),
        isCorrect: typeof isCorrect === 'boolean' ? isCorrect : undefined,
        timeDiffMs: typeof timeDiffMs === 'number' ? timeDiffMs : undefined,
        payload: payload && typeof payload === 'object' ? payload : undefined,
      },
    });

    const actionType = action.trim();
    const normalizedAction = actionType === 'SUCCESS' ? 'COMPLETE' : actionType;
    const hasGameModule = typeof gameModuleId === 'string' && gameModuleId;
    // 寫入 LearningLog：有 gameModuleId 時一律寫；無 gameModuleId 時僅對返回/求助/登出寫入，讓老師歷程區能看到
    const shouldWriteLearningLog =
      hasGameModule || ['BACK', 'HELP', 'LOGOUT'].includes(actionType);
    if (shouldWriteLearningLog) {
      await prisma.learningLog.create({
        data: {
          userId: auth.userId,
          gameModuleId: hasGameModule ? gameModuleId : null,
          actionType: normalizedAction,
          detail: payload && typeof payload === 'object' ? payload : undefined,
        },
      });
    }

    return NextResponse.json({ success: true, id: log.id });
  } catch (error) {
    console.error('POST /api/logs:', error);
    return NextResponse.json(
      { error: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
