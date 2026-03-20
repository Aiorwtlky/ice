'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import { Clock, Megaphone } from 'lucide-react';
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
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export default function StudentAnnouncementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { sendLog } = useGameLog(null);
  const openPosted = useRef(false);

  const { data: meData } = useSWR<{ user?: { role: string; account: string } }>('/api/auth/me', fetcher);
  const { data, error, isLoading } = useSWR(
    id ? `/api/student/announcements/${id}` : null,
    fetcher
  );

  const ann = data?.announcement;

  useEffect(() => {
    if (meData?.user?.role && meData.user.role !== 'STUDENT') {
      router.replace('/dashboard');
    }
  }, [meData, router]);

  useEffect(() => {
    if (!id || !ann || openPosted.current) return;
    openPosted.current = true;
    void fetch(`/api/student/announcements/${id}/open`, { method: 'POST', credentials: 'same-origin' });
  }, [id, ann]);

  const user = meData?.user;

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
      headerTitle={ann?.title ?? '公告內容'}
      headerSubtitle="班級公告"
      userLabel={user.account}
      userSubLabel="學員"
      userAvatar={user.account.slice(0, 2).toUpperCase()}
      headerMenuLinks={[{ label: '📢 班級公告', href: '/student/announcements' }]}
      onLogout={handleLogout}
      showBack
      onBack={() => router.push('/student/announcements')}
      showHelp
      onHelpLog={() => sendLog('HELP')}
      mainLayout="fill"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto w-full max-w-lg">
          {isLoading && <p className="text-center text-sm text-gray-500">載入中...</p>}
          {error || data?.error ? (
            <p className="text-center text-sm text-red-600">無法載入或公告已過期</p>
          ) : null}

          {ann && (
            <>
              <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-extrabold leading-snug text-gray-900">{ann.title}</h1>
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      <p>可閱讀起：{fmt(ann.visibleFrom)}（台北時間）</p>
                      {ann.visibleUntil && (
                        <p className="inline-flex flex-wrap items-center gap-1 font-semibold text-rose-800">
                          <Clock className="h-3.5 w-3.5" />
                          截止：{fmt(ann.visibleUntil)}（台北時間）
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <article className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{ann.body}</div>
              </article>

              <p className="mt-4 text-center text-[11px] text-gray-400">
                你已開啟此公告；開啟時間已記錄供老師查閱。
              </p>
            </>
          )}
        </div>
      </div>
    </GameFrame>
  );
}
