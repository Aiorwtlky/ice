'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { Radar, ArrowRight, Trophy } from 'lucide-react';
import GameFrame from '@/components/GameFrame';
import { useGameLog } from '@/hooks/useGameLog';

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

interface UserMe {
  id: string;
  account: string;
  name: string | null;
  role: string;
  onboardingDone?: boolean;
  studentGroup?: { name?: string; activeTerm?: { name: string } };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function StudentDashboard() {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const [onboardingOverride, setOnboardingOverride] = useState<boolean | null>(null);

  const { data: meData, mutate: mutateMe } = useSWR<{ user?: UserMe }>('/api/auth/me', fetcher, { revalidateOnFocus: false });
  const user = meData?.user ?? null;
  const isStudent = !!user && user.role === 'STUDENT';
  const onboardingDone = onboardingOverride ?? (user?.onboardingDone ?? null);

  const { data: statusData, error, isLoading } = useSWR<StatusData & { error?: string }>(
    isStudent ? '/api/games/status' : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  const { data: compData } = useSWR<{ competitions: { id: string; name: string; status: string }[] }>(
    isStudent ? '/api/class-competitions' : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const competitions = compData?.competitions ?? [];

  useEffect(() => {
    if (!meData) return;
    if (!meData.user) {
      router.replace('/');
      return;
    }
    if (meData.user.role !== 'STUDENT') {
      router.replace('/dashboard');
      return;
    }
  }, [meData, router]);

  const { sendLog } = useGameLog(null);

  const handleOnboardingSubmit = async (gender: string, grade: string) => {
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gender, grade }),
    });
    const data = await res.json();
    if (data.success) {
      setOnboardingOverride(true);
      await mutateMe();
      globalMutate('/api/auth/me');
    }
  };

  const loading = useMemo(() => !meData || !user, [meData, user]);
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">載入中...</p>
      </div>
    );
  }
  if (!user) return null;

  // 首次登入：全螢幕人口變項
  if (onboardingDone === false) {
    return (
      <OnboardingOverlay onSubmit={handleOnboardingSubmit} />
    );
  }

  const status = statusData as StatusData | undefined;
  const classLabel = status?.classGroup?.name ?? user?.studentGroup?.name ?? '我的班級';
  const unlocked = status?.unlocks?.filter((u) => u.isUnlocked) ?? [];
  const allLocked = !isLoading && (status?.unlocks?.length ?? 0) > 0 && unlocked.length === 0;

  return (
    <GameFrame
      headerTitle="NovaInsight 資訊科普教育平台"
      userLabel={user.account}
      userSubLabel={classLabel}
      userAvatar={user.account.slice(0, 2).toUpperCase()}
      onLogout={async () => {
        sendLog('LOGOUT');
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/');
      }}
      showBack={false}
      showHelp
      onHelpLog={() => {
        sendLog('HELP');
      }}
      mainLayout="fill"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-6">
        {competitions.length > 0 && (
          <div className="mx-auto mb-4 w-full max-w-lg shrink-0 rounded-2xl border-2 border-violet-200 bg-violet-50/70 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-violet-600" />
              <h2 className="text-base font-extrabold text-violet-950">班級競賽</h2>
            </div>
            <p className="mb-3 text-xs text-violet-900/80">與課程任務分開；點擊進入可見排行榜與規則。</p>
            <ul className="space-y-2">
              {competitions.map((co) => (
                <li key={co.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/student/competition/${co.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-violet-300 bg-white/90 px-4 py-3 text-left text-sm font-bold text-violet-950 shadow-sm transition hover:border-violet-500"
                  >
                    <span className="min-w-0 flex-1 break-words">{co.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-violet-600">{co.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {allLocked && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <div className="flex w-full max-w-2xl flex-col items-center rounded-2xl border border-amber-200 bg-amber-50/60 p-10 text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-full bg-amber-400/30 blur-xl animate-pulse" />
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
          <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
            <div className="grid gap-3 pb-2">
            {unlocked.map((item) => {
              const title =
                (item.gameName && String(item.gameName).trim()) || item.gameCode || '未命名活動';
              return (
              <button
                type="button"
                key={item.gameModuleId}
                onClick={() => router.push('/student/games/' + item.gameCode)}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-5 text-left shadow-sm transition hover:border-amber-500 hover:bg-amber-50"
              >
                <span className="min-w-0 flex-1 text-left text-base font-semibold leading-snug break-words text-gray-900">
                  {title}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-700">
                  進入任務 <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            );
            })}
            </div>
            </div>
          </div>
        )}
        {!isLoading && (status?.unlocks?.length ?? 0) === 0 && !error && unlocked.length === 0 && !allLocked && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-gray-500">目前沒有任務</p>
          </div>
        )}
        {error && (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-sm text-red-600">無法載入任務，請稍後再試</p>
          </div>
        )}
      </div>
    </GameFrame>
  );
}

function OnboardingOverlay({ onSubmit }: { onSubmit: (gender: string, grade: string) => Promise<void> }) {
  const [gender, setGender] = useState('');
  const [grade, setGrade] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'choose' | 'confirm'>('choose');

  const canConfirm = gender && grade;
  const handleGoConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm) return;
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!gender || !grade) return;
    setSubmitting(true);
    await onSubmit(gender, grade);
    setSubmitting(false);
  };

  const handleBack = () => setStep('choose');

  if (step === 'confirm') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#FDFBF7] p-4">
        <div className="w-full max-w-md rounded-2xl border-2 border-amber-300 bg-white p-8 shadow-xl">
          <h2 className="mb-2 text-center text-xl font-bold text-gray-900">請確認</h2>
          <div className="mb-8 flex justify-center rounded-xl bg-amber-50 py-6 px-4">
            <p className="text-2xl font-bold text-amber-800">我是 <span className="text-amber-600">{gender}</span>，<span className="text-amber-600">{grade}</span></p>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 rounded-xl border-2 border-gray-300 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              ❌ 點錯了，重選
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 rounded-xl bg-amber-500 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {submitting ? '儲存中...' : '✅ 確認，出發！'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#FDFBF7] p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
        <h2 className="mb-2 text-xl font-bold text-gray-900">歡迎！請填寫以下資料</h2>
        <p className="mb-6 text-sm text-gray-500">僅供研究分析使用，填寫後不再顯示</p>
        <form onSubmit={handleGoConfirm} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">性別</label>
            <div className="flex gap-4">
              {['男生', '女生'].map((g) => (
                <label key={g} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={gender === g}
                    onChange={() => setGender(g)}
                    className="h-4 w-4 text-amber-600"
                  />
                  <span>{g}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">年級</label>
            <div className="flex flex-wrap gap-2">
              {['三年級', '四年級', '五年級', '六年級'].map((g) => (
                <label key={g} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="grade"
                    value={g}
                    checked={grade === g}
                    onChange={() => setGrade(g)}
                    className="h-4 w-4 text-amber-600"
                  />
                  <span>{g}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={!canConfirm}
            className="w-full rounded-lg bg-amber-500 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            下一步：確認
          </button>
        </form>
      </div>
    </div>
  );
}
