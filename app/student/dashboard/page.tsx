'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Radar, Gamepad2, ArrowRight, ArrowLeft } from 'lucide-react';

interface UnlockItem {
  unlockId: string | null;
  gameModuleId: string;
  gameCode: string;
  gameName: string;
  isUnlocked: boolean;
}

interface StatusData {
  classGroup: { id: string; name: string };
  unlocks: UnlockItem[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function StudentTaskDashboard() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  const { data, error, isLoading } = useSWR<StatusData & { error?: string }>(
    '/api/games/status',
    fetcher,
    { refreshInterval: 2000 }
  );

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (!res.user) {
          router.replace('/login');
          return;
        }
        if (res.user.role !== 'STUDENT') {
          router.replace('/dashboard');
          return;
        }
        setAuthChecked(true);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  const status = data as StatusData | undefined;
  const unlocked = status?.unlocks?.filter((u) => u.isUnlocked) ?? [];
  const allLocked = !isLoading && status?.unlocks?.length !== 0 && unlocked.length === 0;

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">驗證身分中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flowing-bg" aria-hidden="true">
        <div className="tech-blob tech-blob-1" />
        <div className="tech-blob tech-blob-2" />
        <div className="tech-blob tech-blob-3" />
      </div>

      <header className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur-sm shadow-sm">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            返回
          </button>
          <div className="min-w-0 text-center">
            <div className="truncate text-sm font-semibold text-gray-900">NovaInsight 資訊科普教育平台</div>
            <div className="text-xs font-bold tracking-wider text-gray-500">任務面板</div>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        {allLocked && (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200/60 p-12 max-w-md text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-amber-400/30 blur-2xl animate-pulse" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg">
                <Radar className="h-12 w-12 animate-pulse" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">連線中...</h2>
            <p className="text-gray-600">等待老師開放任務</p>
          </div>
        )}

        {unlocked.length > 0 && (
          <div className="w-full max-w-2xl min-h-0">
            <div className="flex items-center gap-2 mb-6">
              <Gamepad2 className="h-6 w-6 text-amber-600" />
              <h2 className="text-xl font-bold text-gray-900">開放中的任務</h2>
            </div>
            {/* 手機：任務多時可捲動避免擠爆畫面 */}
            <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
              {unlocked.map((item) => (
                <button
                  type="button"
                  key={item.gameModuleId}
                  onClick={() => router.push('/student/games/' + item.gameCode)}
                  className="group w-full flex items-center justify-between gap-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-white p-6 shadow-lg transition-all hover:border-amber-500 hover:shadow-amber-200/50 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                >
                  <div className="min-w-0 text-left">
                    <p className="truncate text-lg font-bold text-gray-900 group-hover:text-amber-700" title={item.gameName}>
                      {item.gameName}
                    </p>
                    <p className="text-sm font-semibold text-amber-700 mt-1 flex items-center gap-1">
                      進入任務
                      <ArrowRight className="h-4 w-4 inline" />
                    </p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-colors">
                    <Gamepad2 className="h-6 w-6" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!isLoading && status?.unlocks?.length === 0 && !error && (
          <p className="text-gray-500">目前沒有任務</p>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            無法載入任務狀態，請稍後再試
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t border-gray-200/80 bg-white/95 py-3 backdrop-blur-sm">
        <div className="space-y-0.5 text-center text-sm text-gray-500">
          <p>教育部帶動中小學計畫</p>
          <p>Google Developer Groups on Campus NTUB</p>
          <p className="text-xs text-gray-400">© 2026</p>
        </div>
      </footer>
    </div>
  );
}
