import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentGroup: {
          include: {
            classGameUnlocks: { select: { id: true, gameModuleId: true, isUnlocked: true } },
          },
        },
        teacherGroups: {
          include: {
            classGameUnlocks: { select: { id: true, gameModuleId: true, isUnlocked: true } },
          },
        },
        classGroupTeacherAssignments: {
          include: {
            classGroup: {
              include: {
                classGameUnlocks: { select: { id: true, gameModuleId: true, isUnlocked: true } },
              },
            },
          },
        },
      },
    });
    return user;
  } catch {
    return null;
  }
}

/** 用 classGroup + 堂次(session) 或 班級級 組出 unlocks 清單 */
function buildUnlocks(
  gameModules: { id: string; code: string; name: string }[],
  sessionUnlocks?: { id: string; gameModuleId: string; isUnlocked: boolean }[],
  classUnlocks?: { id: string; gameModuleId: string; isUnlocked: boolean }[]
) {
  const useSession = sessionUnlocks !== undefined;
  const unlockMap = new Map(
    (useSession ? sessionUnlocks : classUnlocks ?? []).map((u) => [u.gameModuleId, u])
  );
  return gameModules.map((gm) => {
    const u = unlockMap.get(gm.id);
    return {
      unlockId: u?.id ?? null,
      gameModuleId: gm.id,
      gameCode: gm.code,
      gameName: gm.name,
      isUnlocked: u ? u.isUnlocked : false,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });
    if (user.role === 'STUDENT' && user.studentGroup?.loginLocked) {
      const res = NextResponse.json({ error: '尚未開放登入' }, { status: 403 });
      res.cookies.delete('auth-token');
      return res;
    }

    // NOTE: sessionIdParam 用來承載「分類 id」（你要的：分類包活動，分類與班級無關）
    const categoryIdParam = request.nextUrl.searchParams.get('sessionId');

    type ClassGroupSlim = {
      id: string;
      name: string;
      classGameUnlocks: { id: string; gameModuleId: string; isUnlocked: boolean }[];
      loginLocked?: boolean;
    };

    let classGroup: ClassGroupSlim | null = null;

    const teacherClassIdParam = request.nextUrl.searchParams.get('classGroupId');
    if (user.role === 'STUDENT' && user.studentGroup) {
      classGroup = user.studentGroup as unknown as ClassGroupSlim;
    } else if (user.role === 'TEACHER') {
      const mainGroups = user.teacherGroups ?? [];
      const assigned = (user as { classGroupTeacherAssignments?: { classGroup: unknown }[] }).classGroupTeacherAssignments ?? [];
      const assignedGroups = assigned.map((a) => a.classGroup as ClassGroupSlim).filter(Boolean);
      const allGroups = [...mainGroups, ...assignedGroups];
      if (teacherClassIdParam) {
        const chosen = allGroups.find((g: { id: string }) => g.id === teacherClassIdParam);
        classGroup = (chosen ?? null) as ClassGroupSlim | null;
      } else {
        classGroup = (allGroups[0] ?? null) as ClassGroupSlim | null;
      }
    } else if (user.role === 'ADMIN') {
      const cgId = request.nextUrl.searchParams.get('classGroupId');
      if (!cgId) return NextResponse.json({ error: '管理員請提供 classGroupId' }, { status: 400 });
      const cg = await prisma.classGroup.findUnique({
        where: { id: cgId },
        include: {
          classGameUnlocks: { select: { id: true, gameModuleId: true, isUnlocked: true } },
        },
      });
      classGroup = cg as unknown as ClassGroupSlim | null;
    }

    if (!classGroup) return NextResponse.json({ error: '找不到所屬班級' }, { status: 404 });

    // 老師/管理員：僅要「目前已開放」清單（跨分類）
    if (user.role !== 'STUDENT' && request.nextUrl.searchParams.get('openSummary') === '1') {
      const opens = await prisma.classGameUnlock.findMany({
        where: { classGroupId: classGroup.id, isUnlocked: true },
        include: { gameModule: { select: { code: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return NextResponse.json({
        classGroup: { id: classGroup.id, name: classGroup.name },
        openActivities: opens.map((o) => ({
          gameModuleId: o.gameModuleId,
          gameCode: o.gameModule.code,
          gameName: o.gameModule.name,
        })),
      });
    }

    const studentProfile = user.role === 'STUDENT' ? {
      gender: (user as { gender?: string | null }).gender ?? null,
      grade: (user as { grade?: string | null }).grade ?? null,
      onboardingDone: (user as { onboardingDone?: boolean }).onboardingDone ?? false,
    } : undefined;

    const basePayload = () => ({
      classGroup: { id: classGroup.id, name: classGroup.name, loginLocked: (classGroup as { loginLocked?: boolean }).loginLocked },
      ...(studentProfile && { studentProfile }),
    });

    // 學生：顯示「所有分類」裡被老師開放的活動（可跨分類同時出現）
    if (user.role === 'STUDENT') {
      const allModules = await prisma.gameModule.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { createdAt: 'asc' },
      });
      const unlocks = buildUnlocks(allModules, undefined, classGroup.classGameUnlocks);
      return NextResponse.json({ ...basePayload(), unlocks });
    }

    // 由管理員建立的「分類」（terms）— 老師中控台依分類編輯開關
    const categories = await prisma.term.findMany({ select: { id: true, name: true }, orderBy: { createdAt: 'asc' } });
    if (!categories.length) return NextResponse.json({ error: '目前尚無活動分類（請管理員先建立分類與活動）' }, { status: 400 });
    const categoryId = (categoryIdParam && categories.some((c) => c.id === categoryIdParam)) ? categoryIdParam : categories[0].id;
    const category = categories.find((c) => c.id === categoryId) ?? categories[0];

    const gameModules = await prisma.gameModule.findMany({
      where: { termId: categoryId },
      select: { id: true, code: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    const unlocks = buildUnlocks(gameModules, undefined, classGroup.classGameUnlocks);
    return NextResponse.json({
      ...basePayload(),
      sessions: categories.map((c) => ({ id: c.id, name: c.name, sessionAt: null, order: 1 })),
      session: { id: category.id, name: category.name },
      unlocks,
    });
  } catch (err) {
    console.error('GET /api/games/status:', err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });
    if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: '僅老師或管理員可更新解鎖狀態' }, { status: 403 });
    }

    const body = await request.json();
    const { unlockId, isUnlocked, sessionId, classGroupId, gameModuleId } = body;
    if (typeof isUnlocked !== 'boolean') {
      return NextResponse.json({ error: '請提供 isUnlocked (boolean)' }, { status: 400 });
    }

    // 優先：本班 + 活動模組（活動分類用 termId，與 Prisma Session 無關；前端勿把分類 id 當 sessionId 送進舊邏輯）
    if (typeof classGroupId === 'string' && typeof gameModuleId === 'string') {
      if (user.role === 'TEACHER') {
        const mainIds = user.teacherGroups?.map((g) => g.id) ?? [];
        const assignedIds = (user as { classGroupTeacherAssignments?: { classGroupId: string }[] }).classGroupTeacherAssignments?.map((a) => a.classGroupId) ?? [];
        const isMy = mainIds.includes(classGroupId) || assignedIds.includes(classGroupId);
        if (!isMy) return NextResponse.json({ error: '只能更新自己班級' }, { status: 403 });
      }
      const created = await prisma.classGameUnlock.upsert({
        where: { classGroupId_gameModuleId: { classGroupId, gameModuleId } },
        create: { classGroupId, gameModuleId, isUnlocked },
        update: { isUnlocked },
        include: { gameModule: true },
      });
      await prisma.systemLog.create({
        data: {
          userId: user.id,
          classGroupId,
          gameModuleId,
          action: 'UNLOCK_TASK',
          payload: { isUnlocked, gameCode: created.gameModule.code },
        },
      });
      return NextResponse.json({
        success: true,
        unlock: { unlockId: created.id, gameCode: created.gameModule.code, gameName: created.gameModule.name, isUnlocked: created.isUnlocked },
      });
    }

    if (sessionId && typeof sessionId === 'string') {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { classGroup: true },
      });
      if (!session) return NextResponse.json({ error: '找不到該堂次' }, { status: 404 });
      if (user.role === 'TEACHER') {
        const mainIds = user.teacherGroups?.map((g) => g.id) ?? [];
        const assignedIds = (user as { classGroupTeacherAssignments?: { classGroupId: string }[] }).classGroupTeacherAssignments?.map((a) => a.classGroupId) ?? [];
        const isMy = mainIds.includes(session.classGroupId) || assignedIds.includes(session.classGroupId);
        if (!isMy) return NextResponse.json({ error: '只能更新自己班級' }, { status: 403 });
      }
      if (typeof gameModuleId !== 'string') {
        return NextResponse.json({ error: '請提供 gameModuleId' }, { status: 400 });
      }
      const updated = await prisma.sessionGameUnlock.upsert({
        where: { sessionId_gameModuleId: { sessionId, gameModuleId } },
        create: { sessionId, gameModuleId, isUnlocked },
        update: { isUnlocked },
        include: { gameModule: true },
      });
      await prisma.systemLog.create({
        data: {
          userId: user.id,
          classGroupId: session.classGroupId,
          sessionId,
          gameModuleId,
          action: 'UNLOCK_TASK',
          payload: { isUnlocked, gameCode: updated.gameModule.code },
        },
      });
      return NextResponse.json({
        success: true,
        unlock: { unlockId: updated.id, gameCode: updated.gameModule.code, gameName: updated.gameModule.name, isUnlocked: updated.isUnlocked },
      });
    }

    if (unlockId) {
      const unlock = await prisma.classGameUnlock.findUnique({
        where: { id: unlockId },
        include: { classGroup: true, gameModule: true },
      });
      if (!unlock) return NextResponse.json({ error: '找不到該解鎖紀錄' }, { status: 404 });
      if (user.role === 'TEACHER') {
        const mainIds = user.teacherGroups?.map((g) => g.id) ?? [];
        const assignedIds = (user as { classGroupTeacherAssignments?: { classGroupId: string }[] }).classGroupTeacherAssignments?.map((a) => a.classGroupId) ?? [];
        const isMy = mainIds.includes(unlock.classGroupId) || assignedIds.includes(unlock.classGroupId);
        if (!isMy) return NextResponse.json({ error: '只能更新自己班級' }, { status: 403 });
      }
      const updated = await prisma.classGameUnlock.update({
        where: { id: unlockId },
        data: { isUnlocked },
        include: { gameModule: true },
      });
      await prisma.systemLog.create({
        data: {
          userId: user.id,
          classGroupId: unlock.classGroupId,
          gameModuleId: unlock.gameModuleId,
          action: 'UNLOCK_TASK',
          payload: { isUnlocked, gameCode: updated.gameModule.code },
        },
      });
      return NextResponse.json({
        success: true,
        unlock: { unlockId: updated.id, gameCode: updated.gameModule.code, gameName: updated.gameModule.name, isUnlocked: updated.isUnlocked },
      });
    }

    return NextResponse.json({ error: '請提供 classGroupId 與 gameModuleId，或 unlockId，或舊版 sessionId（班級堂次）' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/games/status:', err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
