'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import useSWR from 'swr';
import GameFrame from '@/components/GameFrame';
import { HanoiGame, Click1Game, Click2Game } from '@/components/games/StudentGameViews';
import {
  ChevronLeft,
  BarChart3,
  X,
  PanelRightOpen,
  Lock,
  Unlock as UnlockIcon,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface UnlockItem {
  unlockId: string | null;
  gameModuleId: string;
  gameCode: string;
  gameName: string;
  isUnlocked: boolean;
}

interface StatusData {
  classGroup: { id: string; name: string };
  session?: { id: string; name: string };
  unlocks: UnlockItem[];
}

function fmtTime(iso: string | null) {
  if (!iso) return '未完成';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

function fmtAgo(iso: string | null) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec} 秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小時前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  const diffMon = Math.floor(diffDay / 30);
  if (diffMon < 12) return `${diffMon} 個月前`;
  const diffYr = Math.floor(diffMon / 12);
  return `${diffYr} 年前`;
}

function fmtLogLine(iso: string) {
  const d = new Date(iso);
  const dt = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${dt}.${ms}`;
}

const noopLog = async () => {};

function TeacherPlayPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameCode = typeof params.gameCode === 'string' ? params.gameCode : '';
  const classGroupId = searchParams.get('classGroupId') ?? '';
  const sessionId = searchParams.get('sessionId') ?? '';

  const [user, setUser] = useState<{ account: string } | null>(null);
  const [authOk, setAuthOk] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [toggleSaving, setToggleSaving] = useState(false);
  const hanoiHelpRef = useRef<{ openHelp: () => void } | null>(null);

  const statusUrl =
    classGroupId && sessionId
      ? `/api/games/status?classGroupId=${encodeURIComponent(classGroupId)}&sessionId=${encodeURIComponent(sessionId)}`
      : null;
  const { data: statusData, error: statusErr, mutate: mutateStatus } = useSWR<StatusData & { error?: string }>(
    statusUrl,
    fetcher
  );
  const status = statusData as StatusData | undefined;
  const item = status?.unlocks?.find((u) => u.gameCode === gameCode);

  const progressUrl =
    classGroupId && item?.gameModuleId
      ? `/api/teacher/activity-progress?classGroupId=${encodeURIComponent(classGroupId)}&gameModuleId=${encodeURIComponent(item.gameModuleId)}`
      : null;
  const { data: progressData, mutate: mutateProgress } = useSWR<{
    students: { id: string; account: string; gender: string | null; grade: string | null; lastCompleteAt: string | null }[];
  }>(
    progressUrl,
    fetcher,
    { refreshInterval: 8000 }
  );

  const logsUrl =
    classGroupId && item?.gameModuleId && selectedStudentId
      ? `/api/teacher/activity-logs?classGroupId=${encodeURIComponent(classGroupId)}&gameModuleId=${encodeURIComponent(item.gameModuleId)}&userId=${encodeURIComponent(selectedStudentId)}`
      : null;
  const { data: logsData } = useSWR<{ student: { account: string; name: string | null }; logs: { id: string; actionType: string; detail: unknown; createdAt: string }[] }>(
    logsUrl,
    fetcher
  );

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user || (d.user.role !== 'TEACHER' && d.user.role !== 'ADMIN')) {
          router.replace('/dashboard');
          return;
        }
        setUser(d.user);
        setAuthOk(true);
      })
      .catch(() => router.replace('/'));
  }, [router]);

  const handleSetUnlock = useCallback(
    async (isUnlocked: boolean) => {
      if (!classGroupId || !item?.gameModuleId || toggleSaving) return;
      if (item.isUnlocked === isUnlocked) return;
      setToggleSaving(true);
      const res = await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classGroupId, gameModuleId: item.gameModuleId, isUnlocked }),
      });
      const d = await res.json().catch(() => ({}));
      setToggleSaving(false);
      if (res.ok) mutateStatus();
      else alert((d as { error?: string }).error || '更新失敗');
    },
    [classGroupId, item, toggleSaving, mutateStatus]
  );

  const handleBack = () => {
    router.push('/dashboard/teacher');
  };
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  };

  const headerTitle = 'NovaInsight 資訊科普教育平台';
  const abbr = user?.account?.slice(0, 2).toUpperCase() ?? '師';

  const SidebarInner = (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900"
        >
          <ChevronLeft className="h-4 w-4" />
          回中控台
        </button>
        <button
          type="button"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-label="關閉"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">示範活動</p>
        <p className="mt-1 text-lg font-bold text-gray-900">{item?.gameName ?? gameCode}</p>
        <p className="font-mono text-xs text-gray-500">{gameCode}</p>
        <p className="mt-1 text-xs text-gray-500">分類：{status?.session?.name ?? '—'}</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3">
        <p className="mb-2 text-xs font-bold text-gray-600">學生可否進入此活動</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={toggleSaving || !item}
            onClick={() => handleSetUnlock(true)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl border-2 py-2.5 text-sm font-bold ${
              item?.isUnlocked
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-400'
            } disabled:opacity-50`}
          >
            <UnlockIcon className="h-4 w-4" />
            開放
          </button>
          <button
            type="button"
            disabled={toggleSaving || !item}
            onClick={() => handleSetUnlock(false)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl border-2 py-2.5 text-sm font-bold ${
              item && !item.isUnlocked
                ? 'border-gray-800 bg-gray-800 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
            } disabled:opacity-50`}
          >
            <Lock className="h-4 w-4" />
            關閉
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">與中控台「開放／關閉」同步；學生端僅在開放時可進入。</p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/30">
        <button
          type="button"
          onClick={() => setDataOpen((v) => !v)}
          className="flex w-full items-center justify-between border-b border-amber-100 bg-white/90 px-3 py-2.5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <BarChart3 className="h-4 w-4 text-amber-600" />
            數據（本活動）
          </span>
          <span className="text-xs text-gray-500">{dataOpen ? '收合' : '展開'}</span>
        </button>
        {dataOpen && (
          <div className="max-h-[45vh] overflow-y-auto p-2 lg:max-h-[calc(100vh-22rem)]">
            <p className="mb-2 px-1 text-[11px] text-gray-500">上次通關時間；點學員可看本活動 log</p>
            <ul className="space-y-1">
              {(progressData?.students ?? []).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentId(s.id);
                      setLogModalOpen(true);
                    }}
                    className={`w-full rounded-lg border px-2 py-2 text-left text-sm transition ${
                      selectedStudentId === s.id
                        ? 'border-amber-500 bg-amber-100'
                        : 'border-transparent bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">{s.account}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-gray-600">
                          {s.gender && <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5">{s.gender}</span>}
                          {s.grade && <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5">{s.grade}</span>}
                          {!s.gender && !s.grade && <span className="text-gray-400">—</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-xs font-semibold ${s.lastCompleteAt ? 'text-emerald-700' : 'text-gray-400'}`}>
                          {s.lastCompleteAt ? '已完成' : '未完成'}
                        </div>
                        {s.lastCompleteAt && (
                          <div className="mt-0.5 text-[11px] text-gray-600">
                            {fmtTime(s.lastCompleteAt)}
                          </div>
                        )}
                        {s.lastCompleteAt && (
                          <div className="mt-0.5 text-[11px] text-gray-400">{fmtAgo(s.lastCompleteAt)}</div>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );

  if (!classGroupId || !sessionId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FDFBF7] p-6">
        <p className="text-gray-700">請從老師中控台點「進入示範」</p>
        <button type="button" onClick={handleBack} className="rounded-xl bg-amber-500 px-4 py-2 text-white">
          回中控台
        </button>
      </div>
    );
  }

  if (!authOk) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">驗證中…</p>
      </div>
    );
  }

  if (statusErr || statusData?.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-600">{(statusData as { error?: string })?.error || '無法載入活動'}</p>
        <button type="button" onClick={handleBack} className="rounded-xl bg-gray-200 px-4 py-2">
          返回
        </button>
      </div>
    );
  }

  if (status && !item) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-gray-700">目前分類沒有此活動（{gameCode}）</p>
        <button type="button" onClick={handleBack} className="rounded-xl bg-amber-500 px-4 py-2 text-white">
          回中控台
        </button>
      </div>
    );
  }

  if (!status || !item) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">載入中…</p>
      </div>
    );
  }

  const gameMain = (
    <>
      {gameCode === 'CLICK_1' && (
        <GameFrame
          headerTitle={headerTitle}
          userLabel={`示範 · ${user?.account ?? ''}`}
          userAvatar={abbr}
          onBack={handleBack}
          onLogout={handleLogout}
          onHelp={() => {
            alert('請點擊中間按鈕 1 次');
          }}
          helpTip="請點擊中間按鈕 1 次"
        >
          <Click1Game sendLog={noopLog} onSuccess={handleBack} />
        </GameFrame>
      )}
      {gameCode === 'CLICK_2' && (
        <GameFrame
          headerTitle={headerTitle}
          userLabel={`示範 · ${user?.account ?? ''}`}
          userAvatar={abbr}
          onBack={handleBack}
          onLogout={handleLogout}
          onHelp={() => {
            alert('請『連續』點擊中間按鈕 2 次喔！');
          }}
          helpTip="請連續點擊中間按鈕 2 次"
        >
          <Click2Game sendLog={noopLog} onSuccess={handleBack} />
        </GameFrame>
      )}
      {(gameCode === 'HANOI_3' || gameCode === 'HANOI_4' || gameCode === 'HANOI_5') && (
        <GameFrame
          headerTitle={headerTitle}
          userLabel={`示範 · ${user?.account ?? ''}`}
          userAvatar={abbr}
          onBack={handleBack}
          onLogout={handleLogout}
          onHelpLog={noopLog}
          onHelp={() => hanoiHelpRef.current?.openHelp()}
          helpTip="依盤面給提示"
          mainLayout="fill"
        >
          <HanoiGame
            ref={hanoiHelpRef}
            n={gameCode === 'HANOI_3' ? 3 : gameCode === 'HANOI_4' ? 4 : 5}
            sendLog={noopLog}
            onExit={handleBack}
          />
        </GameFrame>
      )}
      {!['CLICK_1', 'CLICK_2', 'HANOI_3', 'HANOI_4', 'HANOI_5'].includes(gameCode) && (
        <GameFrame headerTitle={headerTitle} userLabel="老師示範" userAvatar={abbr} onBack={handleBack} onLogout={handleLogout}>
          <div className="flex h-full items-center justify-center p-6 text-gray-600">此活動尚無示範畫面</div>
        </GameFrame>
      )}
    </>
  );

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#FDFBF7] lg:pr-80">
      <button
        type="button"
        className="fixed left-3 top-20 z-[100] flex items-center gap-1 rounded-full border border-amber-300 bg-white/95 px-3 py-2 text-xs font-bold text-amber-900 shadow-md lg:hidden"
        onClick={() => setDrawerOpen(true)}
      >
        <PanelRightOpen className="h-4 w-4" />
        控制台
      </button>

      <div className="h-full min-h-0">{gameMain}</div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[90] bg-black/40 lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden />
      )}
      <aside
        className={`fixed right-0 top-0 z-[95] h-full w-[min(100vw-3rem,20rem)] border-l border-gray-200 bg-white shadow-xl transition-transform duration-200 lg:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {SidebarInner}
      </aside>

      {logModalOpen && selectedStudentId && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setLogModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="activity-log-title"
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <div id="activity-log-title" className="truncate text-sm font-extrabold text-gray-900">
                  {logsData ? `${logsData.student.account} 的本活動紀錄` : '載入紀錄中…'}
                </div>
                <div className="truncate text-[11px] text-gray-500">
                  {item?.gameName ?? gameCode} · {status?.classGroup?.name ?? ''}
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                onClick={() => setLogModalOpen(false)}
                aria-label="關閉"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              {!logsData ? (
                <p className="text-sm text-gray-500">載入中…</p>
              ) : logsData.logs.length === 0 ? (
                <p className="text-sm text-gray-500">尚無紀錄</p>
              ) : (
                <ul className="space-y-3">
                  {logsData.logs.map((log) => (
                    <li key={log.id} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-amber-800">{log.actionType}</div>
                        <div className="shrink-0 font-mono text-[10px] text-gray-500">{fmtLogLine(log.createdAt)}</div>
                      </div>
                      {log.detail != null && (
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-2 text-[11px] text-gray-700">
                          {JSON.stringify(log.detail, null, 0)}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-gray-100 p-3">
              <button
                type="button"
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
                onClick={() => setLogModalOpen(false)}
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherPlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
          <p className="text-gray-600">載入中…</p>
        </div>
      }
    >
      <TeacherPlayPageInner />
    </Suspense>
  );
}
