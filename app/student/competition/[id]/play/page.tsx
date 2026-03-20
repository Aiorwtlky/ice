'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import GameFrame from '@/components/GameFrame';
import { HanoiGame } from '@/components/games/StudentGameViews';
import { useCompetitionLog } from '@/hooks/useCompetitionLog';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const COMP_HELP =
  '【班級競賽模式】\n\n此模式不提供解題提示或盤面攻略，請依老師說明與規則自行完成。\n\n操作：點有盤子的柱子拿起最上方一個，再點目標柱放下；大盤不可壓小盤。目標為將全部盤子移到右柱。\n\n如需協助裝置操作，請舉手請老師協助。';

const HEADER_MENU_LINKS = [{ label: '📢 班級公告', href: '/student/announcements' }];

export default function StudentCompetitionPlayPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const [user, setUser] = useState<{ account: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const sendLog = useCompetitionLog(id);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          router.replace('/');
          return;
        }
        if (d.user.role !== 'STUDENT') {
          router.replace('/dashboard');
          return;
        }
        setUser(d.user);
        setAuthChecked(true);
      })
      .catch(() => router.replace('/'));
  }, [router]);

  const { data: detail, mutate } = useSWR(authChecked && id ? `/api/class-competitions/${id}` : null, fetcher, {
    refreshInterval: 2000,
  });

  const c = detail?.competition;
  const isTimeLimit = c?.mode === 'TIME_LIMIT';

  useEffect(() => {
    if (!isTimeLimit) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isTimeLimit]);

  const remainingSec = useMemo(() => {
    if (!isTimeLimit) return null;
    if (detail?.serverNow == null || detail?.remainingTimeMs == null) return null;
    const at = Date.parse(detail.serverNow);
    const remainingMs = detail.remainingTimeMs;
    return Math.max(0, Math.ceil((remainingMs - (nowMs - at)) / 1000));
  }, [isTimeLimit, detail?.serverNow, detail?.remainingTimeMs, nowMs]);

  useEffect(() => {
    if (authChecked && id) {
      sendLog('PLAY_PAGE_MOUNT', { payload: { path: 'play' } });
    }
  }, [authChecked, id, sendLog]);

  const handleBack = useCallback(() => {
    sendLog('BACK_FROM_PLAY', {});
    router.push(`/student/competition/${id}`);
  }, [sendLog, router, id]);

  const handleLogout = async () => {
    await sendLog('LOGOUT_FROM_PLAY', {});
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  };

  const onCompleted = useCallback(
    async (payload: { steps: number; timeMs: number | null }) => {
      await fetch(`/api/class-competitions/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: payload.steps, timeMs: payload.timeMs }),
      });
      mutate();
    },
    [id, mutate]
  );

  if (!authChecked || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">驗證身分中...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">載入比賽…</p>
      </div>
    );
  }

  if (!c || !detail.canPlay) {
    return (
      <GameFrame
        headerMenuLinks={HEADER_MENU_LINKS}
        headerTitle="班級競賽"
        userLabel={user.account}
        userAvatar={user.account.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        helpModalMessage={COMP_HELP}
        mainLayout="fill"
      >
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-gray-700">目前無法進行此比賽（未開放、已結束或逾時）。</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 rounded-xl bg-amber-500 px-6 py-2 font-bold text-white"
          >
            返回競賽首頁
          </button>
        </div>
      </GameFrame>
    );
  }

  const discCount = Math.min(10, Math.max(3, c.discCount));

  return (
    <GameFrame
      headerMenuLinks={HEADER_MENU_LINKS}
      headerTitle="NovaInsight 資訊科普教育平台"
      headerSubtitle={`競賽 · ${c.name}`}
      userLabel={user.account}
      userAvatar={user.account.slice(0, 2).toUpperCase()}
      onBack={handleBack}
      onLogout={handleLogout}
      onHelpLog={() => {
        sendLog('HELP', { payload: { source: 'GameFrame' } });
      }}
      helpModalMessage={COMP_HELP}
      mainLayout="fill"
    >
      <HanoiGame
        n={discCount}
        sendLog={sendLog}
        onExit={handleBack}
        competitionMode
        rainbowDiscs
        competitionHelpMessage={COMP_HELP}
        moveLimit={null}
        timeRemainingSec={remainingSec}
        onCompleted={onCompleted}
      />
    </GameFrame>
  );
}
