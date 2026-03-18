'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { Radar, ArrowRight, Users, ChevronLeft } from 'lucide-react';

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
  activeTerm: { name: string } | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function TeacherPreviewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ok, setOk] = useState(false);
  const [classId, setClassId] = useState<string | null>(null);

  const { data: meData } = useSWR<{ user?: { role: string } }>('/api/auth/me', fetcher);
  const { data: classesData } = useSWR<{ classes: TeacherClass[] }>(ok ? '/api/teacher/classes' : null, fetcher);
  const classes = classesData?.classes ?? [];

  const statusUrl = classId ? `/api/games/status?classGroupId=${classId}` : null;
  const { data: status } = useSWR<StatusData & { error?: string }>(statusUrl, fetcher);

  const { data: studentsData } = useSWR<{ students: { id: string; account: string; name: string | null }[] }>(
    classId ? `/api/class-groups/${classId}/students` : null,
    fetcher
  );
  const students = studentsData?.students ?? [];

  useEffect(() => {
    if (!meData) return;
    if (!meData.user) {
      router.replace('/');
      return;
    }
    if (meData.user.role !== 'TEACHER' && meData.user.role !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }
    setOk(true);
  }, [meData, router]);

  const urlClassId = searchParams.get('classGroupId');
  useEffect(() => {
    if (!classes.length) return;
    const valid = urlClassId && classes.some((c) => c.id === urlClassId);
    setClassId(valid ? urlClassId : classes[0].id);
  }, [classes, urlClassId]);

  const unlocked = status?.unlocks?.filter((u) => u.isUnlocked) ?? [];
  const allLocked = status?.unlocks && status.unlocks.length > 0 && unlocked.length === 0;

  if (!ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">載入中...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-[480px] flex-col overflow-hidden bg-[#FDFBF7]">
      <div className="mx-auto max-w-2xl min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Link href="/dashboard/teacher" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ChevronLeft className="h-4 w-4" /> 返回老師儀表板
          </Link>
        </div>

        <h1 className="mb-4 text-xl font-bold text-gray-900">學生視角預覽</h1>
        <p className="mb-4 text-sm text-gray-500">以老師權限取得該班解鎖狀態，不共用學員介面、無權限問題。</p>

        {classes.length > 1 && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">選擇班級</label>
            <select
              value={classId ?? ''}
              onChange={(e) => setClassId(e.target.value || null)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}（{c.activeTerm?.name ?? '未設定期數'}）</option>
              ))}
            </select>
          </div>
        )}

        {classId && (
          <>
            <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Users className="h-4 w-4" /> 本班學員（{students.length}）
              </h2>
              {students.length > 0 ? (
                <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50 p-2 text-sm">
                  {students.map((s) => (
                    <li key={s.id} className="flex justify-between py-1.5 px-2 rounded hover:bg-white">
                      <span>{s.account}</span>
                      <span className="text-gray-500">{s.name ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">尚無學員</p>
              )}
            </section>

            <section className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
              <p className="mb-4 text-center text-sm text-gray-500">
                學生畫面預覽（{status?.classGroup?.name ?? '—'}）
              </p>
              {(status as { error?: string } | undefined)?.error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {(status as { error?: string }).error}
                </div>
              )}
              {status === undefined && (
                <p className="text-center text-sm text-gray-500">載入中...</p>
              )}
              {status && allLocked && (
                <div className="flex flex-col items-center rounded-2xl border border-amber-100 bg-amber-50/80 p-8 text-center">
                  <Radar className="mb-4 h-12 w-12 text-amber-500 animate-pulse" />
                  <h2 className="font-bold text-gray-900">連線中...</h2>
                  <p className="text-sm text-gray-600">等待老師開放任務</p>
                </div>
              )}
              {status && unlocked.length > 0 && (
                <div className="space-y-3">
                  {unlocked.map((item) => (
                    <div
                      key={item.gameCode}
                      className="flex items-center justify-between rounded-xl border-2 border-amber-300 bg-amber-50/80 p-4"
                    >
                      <span className="font-semibold text-gray-900">{item.gameName}</span>
                      <span className="text-sm text-amber-600">
                        進入任務 <ArrowRight className="inline h-4 w-4" />
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {status && status.unlocks?.length === 0 && (
                <p className="text-center text-sm text-gray-500">目前沒有任務</p>
              )}
            </section>
          </>
        )}

        {ok && classes.length === 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            您尚未被指派任何班級，無法預覽。
          </p>
        )}
      </div>
    </div>
  );
}

export default function TeacherPreviewPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] text-gray-600">載入中...</div>}>
      <TeacherPreviewPageInner />
    </Suspense>
  );
}
