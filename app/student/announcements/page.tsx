'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { Megaphone, ChevronRight, Clock } from 'lucide-react';
import GameFrame from '@/components/GameFrame';
import { useGameLog } from '@/hooks/useGameLog';

const fetcher = (url: string) => fetch(url, { credentials: 'same-origin' }).then((r) => r.json());

function fmt(iso: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function remainingLabel(untilIso: string | null) {
  if (!untilIso) return null;
  const end = new Date(untilIso).getTime();
  const now = Date.now();
  const ms = end - now;
  if (ms <= 0) return '已截止';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 48) return `剩 ${Math.ceil(ms / 86400000)} 天`;
  if (h >= 1) return `剩 ${h} 小時 ${m} 分`;
  return `剩 ${m} 分鐘`;
}

export default function StudentAnnouncementsPage() {
  const router = useRouter();
  const { sendLog } = useGameLog(null);
  const { data: meData } = useSWR<{ user?: { role: string; account: string } }>('/api/auth/me', fetcher);
  const { data, error, isLoading } = useSWR<{ announcements: Array<{
    id: string;
    title: string;
    body: string;
    visibleFrom: string;
    visibleUntil: string | null;
    createdAt: string;
    myRead: { firstOpenedAt: string; lastOpenedAt: string; openCount: number } | null;
  }> }>('/api/student/announcements', fetcher);

  useEffect(() => {
    if (meData?.user?.role && meData.user.role !== 'STUDENT') {
      router.replace('/dashboard');
    }
  }, [meData, router]);

  const listViewLogged = useRef(false);
  useEffect(() => {
    if (!data?.announcements || listViewLogged.current) return;
    listViewLogged.current = true;
    sendLog('ANNOUNCEMENT_LIST_VIEW', { payload: { count: data.announcements.length } });
  }, [data?.announcements, sendLog]);

  const user = meData?.user;
  const list = data?.announcements ?? [];

  const handleLogout = async () => {
    sendLog('LOGOUT');
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  };

  if (!user || user.role !== 'STUDENT') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] text-gray-600">
        載入中...
      </div>
    );
  }

  return (
    <GameFrame
      headerTitle="班級公告"
      headerSubtitle="由老師發布 · 請留意截止時間"
      userLabel={user.account}
      userSubLabel="學員"
      userAvatar={user.account.slice(0, 2).toUpperCase()}
      headerMenuLinks={[{ label: '📢 班級公告', href: '/student/announcements' }]}
      onLogout={handleLogout}
      showBack
      onBack={() => router.push('/dashboard/student')}
      showHelp
      onHelpLog={() => sendLog('HELP')}
      mainLayout="fill"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto w-full max-w-lg">
          <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Megaphone className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold text-gray-900">最新公告</h1>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  點進內容即會記錄開啟時間（含毫秒），老師可於後台查看已讀狀況。
                </p>
              </div>
            </div>
          </div>

          {isLoading && <p className="text-center text-sm text-gray-500">載入中...</p>}
          {error && <p className="text-center text-sm text-red-600">無法載入公告</p>}

          {!isLoading && list.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 py-12 text-center text-sm text-gray-500">
              目前沒有公告
            </div>
          )}

          <ul className="mt-2 space-y-3">
            {list.map((a) => {
              const unread = !a.myRead;
              const remain = remainingLabel(a.visibleUntil);
              return (
                <li key={a.id}>
                  <Link
                    href={`/student/announcements/${a.id}`}
                    className={`flex items-start justify-between gap-3 rounded-2xl border-2 p-4 text-left shadow-sm transition hover:border-sky-400 ${
                      unread ? 'border-amber-300 bg-amber-50/90' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-900">{a.title}</span>
                        {unread && (
                          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            未讀
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-600">{a.body.replace(/\n/g, ' ')}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                        <span>發布 {fmt(a.visibleFrom)}</span>
                        {a.visibleUntil && (
                          <span className="inline-flex items-center gap-1 text-rose-700">
                            <Clock className="h-3 w-3" />
                            截止 {fmt(a.visibleUntil)}
                            {remain ? ` · ${remain}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </GameFrame>
  );
}
