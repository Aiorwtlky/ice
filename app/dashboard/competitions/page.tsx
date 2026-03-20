'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Trophy, Plus, Play, Pause, Square, ListOrdered, ChevronLeft, Eye, EyeOff } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type CompetitionRow = {
  id: string;
  name: string;
  kind: string;
  mode: string;
  status: string;
  discCount: number;
  timeLimitSec: number | null;
  moveLimit: number | null;
  openedAt: string | null;
  hiddenFromStudents?: boolean;
  _count?: { scores: number; logs: number };
};

type ClassOpt = { id: string; name: string; schoolCode?: string };

function DashboardCompetitionsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qpClass = searchParams.get('classGroupId') || '';

  const [classId, setClassId] = useState(qpClass);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'TIME_LIMIT' | 'MOVE_LIMIT'>('TIME_LIMIT');
  const [discCount, setDiscCount] = useState(5);
  const [timeLimitSec, setTimeLimitSec] = useState(600);
  const [rulesText, setRulesText] = useState('');
  const [creating, setCreating] = useState(false);
  const [logModalId, setLogModalId] = useState<string | null>(null);

  const { data: me } = useSWR('/api/auth/me', fetcher);
  const role = me?.user?.role as string | undefined;
  const user = me?.user as { role: string; account: string } | undefined;

  const { data: teacherClasses } = useSWR(
    role === 'TEACHER' ? '/api/teacher/classes' : null,
    fetcher
  );
  const { data: adminClasses } = useSWR(role === 'ADMIN' ? '/api/admin/classes' : null, fetcher);

  const classOptions: ClassOpt[] = useMemo(() => {
    if (role === 'ADMIN') {
      const raw = adminClasses?.classes as { id: string; name: string; schoolCode: string }[] | undefined;
      return (raw ?? []).map((c) => ({ id: c.id, name: c.name, schoolCode: c.schoolCode }));
    }
    const raw = teacherClasses?.classes as { id: string; name: string }[] | undefined;
    return (raw ?? []).map((c) => ({ id: c.id, name: c.name }));
  }, [role, adminClasses, teacherClasses]);

  useEffect(() => {
    if (!me?.user) return;
    if (me.user.role !== 'TEACHER' && me.user.role !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }
  }, [me, router]);

  const effectiveClassId = classId || classOptions[0]?.id || '';

  const listUrl = effectiveClassId
    ? `/api/class-competitions?classGroupId=${encodeURIComponent(effectiveClassId)}`
    : null;
  const { data: listData, mutate } = useSWR<{ competitions: CompetitionRow[] }>(listUrl, fetcher, {
    refreshInterval: 5000,
  });
  const competitions = listData?.competitions ?? [];

  const logUrl =
    logModalId && effectiveClassId ? `/api/class-competitions/${logModalId}/logs?limit=200` : null;
  const { data: logData } = useSWR(logUrl, fetcher);

  const handleCreate = async () => {
    if (!effectiveClassId || !name.trim()) {
      alert('請選擇班級並填寫比賽名稱');
      return;
    }
    setCreating(true);
    const res = await fetch('/api/class-competitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        classGroupId: effectiveClassId,
        name: name.trim(),
        mode,
        discCount: Number(discCount),
        timeLimitSec: mode === 'TIME_LIMIT' ? Number(timeLimitSec) : undefined,
        rulesText: rulesText.trim() || undefined,
      }),
    });
    const raw = await res.text();
    let d: { error?: string } = {};
    try {
      if (raw) d = JSON.parse(raw) as { error?: string };
    } catch {
      d = {};
    }
    setCreating(false);
    if (!res.ok) {
      alert((d as { error?: string }).error || '建立失敗');
      return;
    }
    setName('');
    mutate();
  };

  const patchStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/class-competitions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) alert((d as { error?: string }).error || '更新失敗');
    else mutate();
  };

  const patchStudentVisibility = async (id: string, hiddenFromStudents: boolean) => {
    const res = await fetch(`/api/class-competitions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ hiddenFromStudents }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) alert((d as { error?: string }).error || '更新失敗');
    else mutate();
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">載入中…</p>
      </div>
    );
  }

  const backHref = user.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/teacher';

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <header className="border-b border-gray-200 bg-white/95 px-4 py-4 shadow-sm md:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
            返回儀表板
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="h-7 w-7 text-amber-500" />
            <h1 className="text-xl font-extrabold text-gray-900">班級競賽</h1>
          </div>
          <span className="text-sm text-gray-500">（與「課程任務／活動」分開管理）</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6 md:px-8">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-bold text-gray-700">選擇班級</label>
          <select
            value={effectiveClassId}
            onChange={(e) => setClassId(e.target.value)}
            className="mt-2 w-full max-w-md rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.schoolCode ? ` (${c.schoolCode})` : ''}
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900">
            <Plus className="h-5 w-5 text-amber-600" />
            新增河內塔比賽
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-600">比賽名稱</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="例：第五組河內塔挑戰"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600">層數（3–10）</label>
              <input
                type="number"
                min={3}
                max={10}
                value={discCount}
                onChange={(e) => setDiscCount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600">模式</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'TIME_LIMIT' | 'MOVE_LIMIT')}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="TIME_LIMIT">限時（開放後計時，可暫停）</option>
                <option value="MOVE_LIMIT">計次（比完成步數，無步數上限）</option>
              </select>
            </div>
            {mode === 'TIME_LIMIT' ? (
              <div>
                <label className="text-xs font-bold text-gray-600">總時間（秒）</label>
                <input
                  type="number"
                  min={30}
                  max={86400}
                  value={timeLimitSec}
                  onChange={(e) => setTimeLimitSec(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-violet-200/80 bg-violet-50/90 px-3 py-2.5 text-xs leading-relaxed text-violet-900">
                <span className="font-bold">計次模式：</span>
                依完成步數排名（步數愈少愈好），不設步數上限。
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-600">規則補充（選填）</label>
              <textarea
                value={rulesText}
                onChange={(e) => setRulesText(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={creating || !effectiveClassId}
            onClick={handleCreate}
            className="mt-4 rounded-xl bg-amber-500 px-6 py-3 text-sm font-extrabold text-white shadow hover:bg-amber-600 disabled:opacity-50"
          >
            {creating ? '建立中…' : '建立草稿'}
          </button>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-gray-900">比賽列表</h2>
          <p className="mt-1 text-sm text-gray-500">
            草稿 → 按「開放」後學生可進入；可暫停、結束。已結束的比賽可「對學生隱藏」，學生儀表板將不再顯示（限時結束後常用）。
          </p>
          <ul className="mt-4 space-y-3">
            {competitions.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-extrabold text-gray-900">{row.name}</p>
                    <p className="text-xs text-gray-500">
                      河內塔 {row.discCount} 層 ·{' '}
                      {row.mode === 'TIME_LIMIT' ? `限時 ${row.timeLimitSec}s` : '計次（比步數）'}
                      ·{' '}
                      <span className="font-semibold text-amber-800">{row.status}</span>
                      {row.hiddenFromStudents ? (
                        <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 font-bold text-violet-800">
                          學生端已隱藏
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-400">
                      成績筆數 {row._count?.scores ?? 0} · log {row._count?.logs ?? 0}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => patchStatus(row.id, 'OPEN')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        <Play className="h-3.5 w-3.5" />
                        開放
                      </button>
                    )}
                    {row.status === 'OPEN' && (
                      <>
                        <button
                          type="button"
                          onClick={() => patchStatus(row.id, 'PAUSED')}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
                        >
                          <Pause className="h-3.5 w-3.5" />
                          暫停
                        </button>
                        <button
                          type="button"
                          onClick={() => patchStatus(row.id, 'ENDED')}
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-2 text-xs font-bold text-white"
                        >
                          <Square className="h-3.5 w-3.5" />
                          結束
                        </button>
                      </>
                    )}
                    {row.status === 'PAUSED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => patchStatus(row.id, 'OPEN')}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                        >
                          <Play className="h-3.5 w-3.5" />
                          繼續
                        </button>
                        <button
                          type="button"
                          onClick={() => patchStatus(row.id, 'ENDED')}
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-2 text-xs font-bold text-white"
                        >
                          <Square className="h-3.5 w-3.5" />
                          結束
                        </button>
                      </>
                    )}
                    {row.status === 'ENDED' && (
                      <button
                        type="button"
                        onClick={() => patchStudentVisibility(row.id, !row.hiddenFromStudents)}
                        className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white hover:bg-violet-800"
                      >
                        {row.hiddenFromStudents ? (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            恢復學生端顯示
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            對學生隱藏
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setLogModalId(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-800"
                    >
                      <ListOrdered className="h-3.5 w-3.5" />
                      檢視 log
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {effectiveClassId && competitions.length === 0 && (
            <p className="mt-4 text-sm text-gray-500">尚無比賽，請先建立。</p>
          )}
        </section>
      </main>

      {logModalId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setLogModalId(null)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-3xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="font-bold text-gray-900">競賽 log（JSON）</span>
              <button type="button" className="text-sm text-gray-500 hover:text-gray-800" onClick={() => setLogModalId(null)}>
                關閉
              </button>
            </div>
            <div className="max-h-[min(75vh,520px)] overflow-auto p-3 font-mono text-[11px] leading-relaxed">
              {(logData?.logs ?? []).map(
                (l: {
                  id: string;
                  action: string;
                  createdAt: string;
                  payload: unknown;
                  user: { account: string };
                }) => (
                  <pre key={l.id} className="mb-2 whitespace-pre-wrap break-all rounded border border-gray-100 bg-gray-50 p-2">
                    {JSON.stringify(
                      {
                        at: l.createdAt,
                        account: l.user?.account,
                        action: l.action,
                        payload: l.payload,
                      },
                      null,
                      2
                    )}
                  </pre>
                )
              )}
              {logData?.logs?.length === 0 && <p className="text-sm text-gray-500">尚無紀錄</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardCompetitionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
          <p className="text-gray-600">載入中…</p>
        </div>
      }
    >
      <DashboardCompetitionsPageInner />
    </Suspense>
  );
}
