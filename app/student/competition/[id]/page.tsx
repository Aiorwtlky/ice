'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import GameFrame from '@/components/GameFrame';
import { Trophy, User, ScrollText, Play, Medal } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type LeaderRow = {
  rank: number;
  account: string;
  name: string | null;
  bestSteps: number;
  bestTimeMs: number | null;
};

type Me = { account: string; name?: string | null };

export default function StudentCompetitionHubPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const [user, setUser] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

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

  const { data: detail, error: detailErr } = useSWR(
    authChecked && id ? `/api/class-competitions/${id}` : null,
    fetcher,
    { refreshInterval: 4000 }
  );
  const { data: lbData } = useSWR(
    authChecked && id ? `/api/class-competitions/${id}/leaderboard` : null,
    fetcher,
    { refreshInterval: 4000 }
  );

  const c = detail?.competition;
  const leaderboard: LeaderRow[] = lbData?.leaderboard ?? [];
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const headerTitle = 'NovaInsight 資訊科普教育平台';
  const helpMsg =
    '這是「班級競賽」頁面：左側為你的帳號、規則與進入比賽；右側為即時排行榜。\n\n求助在競賽進行中不提供解題提示，只會顯示操作說明。';

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">驗證身分中...</p>
      </div>
    );
  }

  const canEnter =
    !!detail?.canPlay &&
    c &&
    c.status === 'OPEN' &&
    (c.mode !== 'TIME_LIMIT' || (detail.remainingTimeMs ?? 1) > 0);

  return (
    <GameFrame
      headerTitle={headerTitle}
      headerSubtitle={c?.name ? `班級競賽 · ${c.name}` : '班級競賽'}
      userLabel={user?.account}
      userAvatar={user?.account?.slice(0, 2).toUpperCase()}
      onBack={() => router.push('/dashboard/student')}
      onLogout={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/');
      }}
      helpModalMessage={helpMsg}
      mainLayout="fill"
    >
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-2 sm:p-4 lg:flex-row lg:gap-4">
        {/* 左：個資、規則、進入 */}
        <section className="flex min-h-0 w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-[min(100%,380px)] lg:max-w-[40%]">
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                <User className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800">我的帳號</p>
                <p className="truncate text-lg font-extrabold text-gray-900">{user?.account}</p>
                {user?.name ? <p className="truncate text-sm text-gray-600">{user.name}</p> : null}
              </div>
            </div>
            {detail?.myScore ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm">
                <span className="font-bold text-emerald-900">我的最佳：</span>
                <span className="tabular-nums font-extrabold text-emerald-800"> {detail.myScore.bestSteps} 步</span>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-gray-900">
              <ScrollText className="h-5 w-5 text-sky-600" />
              <h2 className="text-base font-extrabold">規則與說明</h2>
            </div>
            {c ? (
              <ul className="space-y-2 text-sm leading-relaxed text-gray-700">
                <li>
                  <span className="font-semibold text-gray-900">比賽：</span>
                  {c.name}
                </li>
                <li>
                  <span className="font-semibold text-gray-900">項目：</span>
                  河內塔 {c.discCount} 層
                </li>
                <li>
                  <span className="font-semibold text-gray-900">模式：</span>
                  {c.mode === 'TIME_LIMIT'
                    ? `限時（${c.timeLimitSec} 秒）`
                    : '計次（依完成步數排名，無步數上限）'}
                </li>
                <li>
                  <span className="font-semibold text-gray-900">狀態：</span>
                  {c.status === 'DRAFT' && '尚未開放'}
                  {c.status === 'OPEN' && '進行中'}
                  {c.status === 'PAUSED' && '暫停中'}
                  {c.status === 'ENDED' && '已結束'}
                </li>
                {c.rulesText ? (
                  <li className="whitespace-pre-wrap border-t border-gray-100 pt-2 text-gray-600">{c.rulesText}</li>
                ) : (
                  <li className="text-gray-500">老師未額外補充規則。請將所有盤子移至右柱，大盤不可壓小盤。</li>
                )}
              </ul>
            ) : detailErr ? (
              <p className="text-sm text-red-600">無法載入比賽資料</p>
            ) : (
              <p className="text-sm text-gray-500">載入中...</p>
            )}
          </div>

          <button
            type="button"
            disabled={!canEnter}
            onClick={() => router.push(`/student/competition/${id}/play`)}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-base font-extrabold text-white shadow-md transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-5 w-5 shrink-0" />
            進入比賽
          </button>
          {!canEnter && c?.status === 'ENDED' && (
            <p className="text-center text-xs text-gray-500">比賽已結束，可查看排行榜。</p>
          )}
          {!canEnter && c?.status === 'DRAFT' && (
            <p className="text-center text-xs text-gray-500">老師尚未開放此比賽。</p>
          )}
        </section>

        {/* 右：排行榜 */}
        <section className="flex min-h-0 min-h-[40vh] flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-inner lg:min-h-0">
          <div className="shrink-0 border-b border-gray-100 px-3 py-3 sm:px-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-extrabold text-gray-900">排行榜</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">依步數由少到多（越少越好）</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {top3.length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
                {top3.map((row, i) => (
                  <div
                    key={row.account + i}
                    className={`rounded-xl border-2 p-2 text-center sm:p-3 ${
                      i === 0
                        ? 'border-amber-400 bg-amber-50'
                        : i === 1
                          ? 'border-slate-300 bg-slate-50'
                          : 'border-orange-200 bg-orange-50/80'
                    }`}
                  >
                    <div className="flex justify-center">
                      <Medal
                        className={`h-6 w-6 ${
                          i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : 'text-orange-600'
                        }`}
                      />
                    </div>
                    <div className="mt-1 text-xs font-bold text-gray-500">第 {row.rank} 名</div>
                    <div className="truncate text-sm font-extrabold text-gray-900">{row.name || row.account}</div>
                    <div className="text-lg font-black tabular-nums text-amber-700">{row.bestSteps}</div>
                    <div className="text-[10px] text-gray-500">步</div>
                  </div>
                ))}
              </div>
            )}

            <ul className="space-y-2">
              {rest.map((row) => (
                <li
                  key={row.rank + row.account}
                  className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-8 shrink-0 text-center text-sm font-bold text-gray-400">{row.rank}</span>
                    <span className="truncate font-semibold text-gray-900">{row.name || row.account}</span>
                  </span>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-amber-700">{row.bestSteps} 步</span>
                </li>
              ))}
            </ul>

            {leaderboard.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">尚無成績，快當第一個挑戰者！</p>
            )}
          </div>
        </section>
      </div>
    </GameFrame>
  );
}
