'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { Radar, ArrowRight, Users, ChevronLeft, Trophy } from 'lucide-react';
import GameFrame from '@/components/GameFrame';

interface UnlockItem {
  gameCode: string;
  gameName: string;
  isUnlocked: boolean;
}

interface StatusData {
  classGroup: { id: string; name: string };
  unlocks: UnlockItem[];
}

interface TeacherClass {
  id: string;
  name: string;
  activeTerm: { id: string; name: string } | null;
}

const fetcher = (url: string) => fetch(url, { credentials: 'same-origin' }).then((r) => r.json());

function TeacherPreviewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [classId, setClassId] = useState<string | null>(null);

  const { data: meData } = useSWR<{ user?: { role: string; account: string } }>('/api/auth/me', fetcher);
  const role = meData?.user?.role ?? null;
  const ok = role === 'TEACHER' || role === 'ADMIN';
  const account = meData?.user?.account ?? '';

  const { data: classesData } = useSWR<{ classes: TeacherClass[] }>(ok ? '/api/teacher/classes' : null, fetcher);
  const classes = classesData?.classes ?? [];

  const urlClassId = searchParams.get('classGroupId');
  const effectiveClassId = useMemo(() => {
    if (classId) return classId;
    if (!classes.length) return null;
    const valid = urlClassId && classes.some((c) => c.id === urlClassId);
    return valid ? urlClassId : classes[0].id;
  }, [classId, classes, urlClassId]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === effectiveClassId) ?? null,
    [classes, effectiveClassId]
  );
  const termId = selectedClass?.activeTerm?.id ?? null;

  const statusUrl = useMemo(() => {
    if (!effectiveClassId) return null;
    const base = `/api/games/status?classGroupId=${encodeURIComponent(effectiveClassId)}`;
    // 與中控台一致：用班級「目前期數」對應活動分類（sessionId = term id）
    return termId ? `${base}&sessionId=${encodeURIComponent(termId)}` : base;
  }, [effectiveClassId, termId]);

  const { data: status, error: statusError } = useSWR<StatusData & { error?: string }>(statusUrl, fetcher, {
    refreshInterval: 4000,
  });

  const { data: studentsData } = useSWR<{ students: { id: string; account: string; name: string | null }[] }>(
    effectiveClassId ? `/api/class-groups/${effectiveClassId}/students` : null,
    fetcher
  );
  const students = studentsData?.students ?? [];

  const { data: compData } = useSWR<{ competitions: { id: string; name: string; status: string }[] }>(
    ok && effectiveClassId ? `/api/class-competitions?classGroupId=${encodeURIComponent(effectiveClassId)}` : null,
    fetcher,
    { refreshInterval: 8000 }
  );
  const competitions = compData?.competitions ?? [];

  useEffect(() => {
    if (!meData) return;
    if (!meData.user) {
      router.replace('/');
      return;
    }
    if (!ok) {
      router.replace('/dashboard');
      return;
    }
  }, [meData, router, ok]);

  const unlocked = status?.unlocks?.filter((u) => u.isUnlocked) ?? [];
  const allLocked = status?.unlocks && status.unlocks.length > 0 && unlocked.length === 0;
  const isLoading = status === undefined && !statusError;

  const playHref = (gameCode: string) => {
    const q = new URLSearchParams();
    if (effectiveClassId) q.set('classGroupId', effectiveClassId);
    if (termId) q.set('sessionId', termId);
    const qs = q.toString();
    return `/dashboard/teacher/play/${encodeURIComponent(gameCode)}${qs ? `?${qs}` : ''}`;
  };

  if (!ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">載入中...</p>
      </div>
    );
  }

  return (
    <GameFrame
      headerTitle="NovaInsight 資訊科普教育平台"
      userLabel={account || '老師'}
      userAvatar={(account || '老').slice(0, 2).toUpperCase()}
      onBack={() => router.push('/dashboard/teacher')}
      showBack
      showHelp={false}
      mainLayout="fill"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-6">
        <div className="mb-4 shrink-0 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-white px-4 py-3 shadow-sm">
          <Link
            href="/dashboard/teacher"
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-800 hover:text-amber-950"
          >
            <ChevronLeft className="h-4 w-4" /> 返回老師儀表板
          </Link>
          <h1 className="mt-2 text-lg font-extrabold text-gray-900">學生視角預覽</h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            依班級<strong className="text-gray-900">目前期數</strong>載入活動清單（與學生端一致）。點<strong className="text-gray-900">任務</strong>會開啟
            <span className="text-amber-800">老師示範頁</span>（非學生帳號，不會寫入學生成績）。
          </p>
        </div>

        {classes.length > 1 && (
          <div className="mb-4 shrink-0 rounded-xl border border-gray-200 bg-white/90 p-3 shadow-sm">
            <label className="mb-1 block text-xs font-bold text-gray-700">選擇班級</label>
            <select
              value={effectiveClassId ?? ''}
              onChange={(e) => setClassId(e.target.value || null)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{c.activeTerm?.name ?? '未設定期數'}）
                </option>
              ))}
            </select>
          </div>
        )}

        {effectiveClassId && (
          <>
            <section className="mb-4 shrink-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-md">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Users className="h-4 w-4 text-amber-600" /> 本班學員（{students.length}）
              </h2>
              {students.length > 0 ? (
                <ul className="max-h-36 overflow-y-auto overscroll-contain rounded-xl border border-gray-100 bg-gray-50/80 p-2 text-sm [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
                  {students.map((s) => (
                    <li key={s.id} className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-white">
                      <span className="font-medium text-gray-900">{s.account}</span>
                      <span className="text-gray-500">{s.name ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">尚無學員</p>
              )}
            </section>

            {competitions.length > 0 && (
              <div className="mx-auto mb-4 w-full max-w-lg shrink-0 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-md">
                <div className="mb-2 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-violet-600" />
                  <h2 className="text-base font-extrabold text-violet-950">班級競賽</h2>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-violet-900/80">
                  學生端連結需以學生帳號登入。老師請至「班級競賽」管理或從示範頁側欄查看。
                </p>
                <ul className="space-y-2">
                  {competitions.map((co) => (
                    <li key={co.id}>
                      <Link
                        href={`/dashboard/competitions?classGroupId=${encodeURIComponent(effectiveClassId)}`}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-violet-200 bg-white px-4 py-3 text-left text-sm font-bold text-violet-950 shadow-sm transition hover:border-violet-400 hover:bg-violet-50/80"
                      >
                        <span className="min-w-0 flex-1 break-words">{co.name}</span>
                        <span className="shrink-0 text-xs font-semibold text-violet-600">{co.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-center text-[11px] text-violet-700/90">上列連結開啟老師的競賽管理（同班級）</p>
              </div>
            )}

            <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col overflow-hidden">
              <p className="mb-2 shrink-0 text-center text-xs text-gray-500">
                預覽 · {status?.classGroup?.name ?? selectedClass?.name ?? '—'}
                {termId ? ` · 期數：${selectedClass?.activeTerm?.name ?? ''}` : ''}
              </p>
              {(status as { error?: string } | undefined)?.error && (
                <div className="mb-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {(status as { error?: string }).error}
                </div>
              )}
              {isLoading && <p className="text-center text-sm text-gray-500">載入任務中...</p>}
              {statusError && (
                <p className="text-center text-sm text-red-600">無法載入任務狀態</p>
              )}
              {allLocked && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                  <div className="flex w-full max-w-2xl flex-col items-center rounded-2xl border border-amber-200 bg-amber-50/60 p-10 text-center">
                    <div className="relative mb-4">
                      <div className="absolute inset-0 animate-pulse rounded-full bg-amber-400/30 blur-xl" />
                      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white">
                        <Radar className="h-12 w-12 animate-pulse" />
                      </div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">連線中...</h2>
                    <p className="mt-1 text-base text-gray-700">等待老師開放任務</p>
                  </div>
                </div>
              )}
              {unlocked.length > 0 && (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth pr-1 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
                  <div className="grid gap-3 pb-6">
                    {unlocked.map((item, uIdx) => {
                      const title =
                        (item.gameName && String(item.gameName).trim()) || item.gameCode || '未命名活動';
                      return (
                        <Link
                          key={`${item.gameCode}-${uIdx}`}
                          href={playHref(item.gameCode)}
                          className="flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-400/90 bg-gradient-to-r from-amber-50 to-white p-4 text-left shadow-md transition hover:border-amber-500 hover:shadow-lg sm:p-5"
                        >
                          <span className="min-w-0 flex-1 break-words text-base font-semibold leading-snug text-gray-900">
                            {title}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 text-sm font-bold text-white shadow-sm">
                            示範 <ArrowRight className="h-4 w-4" />
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
              {!isLoading && (status?.unlocks?.length ?? 0) === 0 && !allLocked && !(status as { error?: string })?.error && (
                <p className="text-center text-sm text-gray-500">目前沒有任務（或該期數下尚無活動模組）</p>
              )}
            </div>
          </>
        )}

        {ok && classes.length === 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">您尚未被指派任何班級，無法預覽。</p>
        )}
      </div>
    </GameFrame>
  );
}

export default function TeacherPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] text-gray-600">載入中...</div>
      }
    >
      <TeacherPreviewPageInner />
    </Suspense>
  );
}
