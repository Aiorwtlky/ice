'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, BarChart3, X } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const fmtLogTime = (iso: string) => {
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
};

const fmtAgo = (iso: string | null) => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec} 秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小時前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  const diffMon = Math.floor(diffDay / 30);
  if (diffMon < 12) return `${diffMon} 個月前`;
  return `${Math.floor(diffMon / 12)} 年前`;
};

interface ClassRow {
  id: string;
  name: string;
  schoolCode?: string;
  studentCount?: number;
}

interface RespondentsPayload {
  form: { id: string; title: string };
  classGroup: { id: string; name: string; schoolCode: string };
  students: {
    id: string;
    account: string;
    name: string | null;
    gender: string | null;
    grade: string | null;
    submission: {
      id: string;
      status: string;
      attemptNumber: number;
      submittedAt: string | null;
      updatedAt: string;
      answerCount: number;
    } | null;
  }[];
}

function useRespondentsByClasses(formId: string, classIds: string[]) {
  const key =
    formId && classIds.length > 0
      ? ['form-respondents', formId, [...classIds].sort().join(',')]
      : null;
  return useSWR<RespondentsPayload[]>(
    key,
    async () => {
      const rows = await Promise.all(
        classIds.map(async (cid) => {
          const res = await fetch(
            `/api/form-activities/${encodeURIComponent(formId)}/respondents?classGroupId=${encodeURIComponent(cid)}`
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '載入失敗');
          return data as RespondentsPayload;
        })
      );
      return rows;
    },
    { revalidateOnFocus: false }
  );
}

export default function FormResponsesPage() {
  const params = useParams();
  const router = useRouter();
  const formId = typeof params.formId === 'string' ? params.formId : '';

  const { data: meData, isLoading: authLoading } = useSWR<{ user?: { role: string } }>(
    '/api/auth/me',
    fetcher
  );
  const role = meData?.user?.role;
  const isAdmin = role === 'ADMIN';
  const isTeacher = role === 'TEACHER';

  const { data: adminClasses } = useSWR<{ classes: ClassRow[] }>(
    isAdmin ? '/api/admin/classes' : null,
    fetcher
  );
  const { data: teacherClasses } = useSWR<{ classes: ClassRow[] }>(
    isTeacher ? '/api/teacher/classes' : null,
    fetcher
  );

  const classIds = useMemo(() => {
    if (isAdmin) return (adminClasses?.classes ?? []).map((c) => c.id);
    if (isTeacher) return (teacherClasses?.classes ?? []).map((c) => c.id);
    return [];
  }, [isAdmin, isTeacher, adminClasses?.classes, teacherClasses?.classes]);

  const { data: sections, error, isLoading } = useRespondentsByClasses(formId, classIds);

  const [modal, setModal] = useState<{
    userId: string;
    classGroupId: string;
    account: string;
    name: string | null;
  } | null>(null);

  const detailUrl =
    modal && formId
      ? `/api/form-activities/${encodeURIComponent(formId)}/students/${encodeURIComponent(modal.userId)}/submission-detail?classGroupId=${encodeURIComponent(modal.classGroupId)}`
      : null;

  const { data: detailData, isLoading: detailLoading } = useSWR(detailUrl, fetcher);

  if (!authLoading && role !== 'ADMIN' && role !== 'TEACHER') {
    router.replace('/dashboard');
    return null;
  }

  const formTitle = sections?.[0]?.form.title ?? '表單填答狀況';

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-amber-700">NovaInsight 資訊科普教育平台</p>
            <h1 className="mt-2 text-2xl font-black text-gray-900 md:text-3xl">{formTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {isAdmin
                ? '管理員可查看所有班級學生；點選學生可開啟填答詳情與操作紀錄。'
                : '依班級列出學生；已送出顯示送出時間，暫存顯示最後更新時間（與遊戲通關時間概念相同）。'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/forms"
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              表單列表
            </Link>
            <Link
              href={`/dashboard/forms/${formId}/edit`}
              className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900"
            >
              編輯／查看表單
            </Link>
          </div>
        </header>

        {authLoading || (isAdmin && !adminClasses) || (isTeacher && !teacherClasses) ? (
          <p className="text-center text-gray-600">載入中...</p>
        ) : classIds.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-8 text-center text-gray-700">
            目前沒有可管理的班級
          </div>
        ) : isLoading ? (
          <p className="text-center text-gray-600">載入填答資料中...</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {(error as Error).message || '載入失敗'}
          </div>
        ) : (
          <div className="space-y-8">
            {(sections ?? []).map((block) => {
              const submitted = block.students.filter((s) => s.submission?.status === 'SUBMITTED').length;
              const draft = block.students.filter((s) => s.submission?.status === 'DRAFT').length;
              const empty = block.students.filter((s) => !s.submission).length;
              return (
                <section
                  key={block.classGroup.id}
                  className="overflow-hidden rounded-[28px] border border-gray-200/80 bg-white/95 shadow-xl"
                >
                  <div className="flex flex-col gap-2 border-b border-amber-100 bg-gradient-to-r from-amber-50/90 to-white px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-gray-900">{block.classGroup.name}</h2>
                        <p className="text-xs text-gray-500">
                          班級代碼 {block.classGroup.schoolCode} · 共 {block.students.length} 人
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                        已送出 {submitted}
                      </span>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                        草稿 {draft}
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                        未填 {empty}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/90 text-xs font-bold uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-3">學員帳號</th>
                          <th className="px-4 py-3">姓名</th>
                          <th className="px-4 py-3 hidden sm:table-cell">性別</th>
                          <th className="px-4 py-3 hidden sm:table-cell">年級</th>
                          <th className="px-4 py-3">填答狀況</th>
                          <th className="px-4 py-3">時間</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.students.map((s) => {
                          const sub = s.submission;
                          let statusLabel = '尚未填寫';
                          let timeLabel = '—';
                          let timeIso: string | null = null;
                          if (sub) {
                            if (sub.status === 'SUBMITTED' && sub.submittedAt) {
                              statusLabel = '已送出';
                              timeLabel = fmtLogTime(sub.submittedAt);
                              timeIso = sub.submittedAt;
                            } else if (sub.status === 'SUBMITTED') {
                              statusLabel = '已送出';
                              timeLabel = fmtLogTime(sub.updatedAt);
                              timeIso = sub.updatedAt;
                            } else {
                              statusLabel = '草稿';
                              timeLabel = `更新 ${fmtLogTime(sub.updatedAt)}`;
                              timeIso = sub.updatedAt;
                            }
                          }
                          return (
                            <tr
                              key={s.id}
                              className="cursor-pointer border-b border-gray-100 transition hover:bg-amber-50/50"
                              onClick={() =>
                                setModal({
                                  userId: s.id,
                                  classGroupId: block.classGroup.id,
                                  account: s.account,
                                  name: s.name,
                                })
                              }
                            >
                              <td className="px-4 py-3 font-mono font-semibold text-gray-900">{s.account}</td>
                              <td className="px-4 py-3 text-gray-800">{s.name ?? '—'}</td>
                              <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                                {s.gender ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                                {s.grade ?? '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                    sub?.status === 'SUBMITTED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : sub
                                        ? 'bg-amber-100 text-amber-900'
                                        : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                                {sub && (
                                  <span className="ml-2 text-xs text-gray-500">({sub.answerCount} 題有存檔)</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-700">
                                <div>{timeLabel}</div>
                                {timeIso && <div className="text-[11px] text-gray-400">{fmtAgo(timeIso)}</div>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModal(null)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="form-detail-title"
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <div id="form-detail-title" className="truncate text-sm font-extrabold text-gray-900">
                  {modal.account} 的填答狀況
                </div>
                <div className="truncate text-[11px] text-gray-500">
                  {detailData?.form?.title ?? formTitle} · {modal.name ?? '—'}
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                onClick={() => setModal(null)}
                aria-label="關閉"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(90vh-8rem)] overflow-y-auto p-4">
              {detailLoading || !detailData ? (
                <p className="text-sm text-gray-500">載入中…</p>
              ) : detailData.error ? (
                <p className="text-sm text-red-600">{detailData.error}</p>
              ) : (
                <>
                  {detailData.submission ? (
                    <section className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-bold text-sky-900">
                          狀態：{detailData.submission.status === 'SUBMITTED' ? '已送出' : '草稿'}
                        </span>
                        <span className="text-xs text-sky-800">
                          第 {detailData.submission.attemptNumber} 次 · 更新{' '}
                          {fmtLogTime(detailData.submission.updatedAt)}
                        </span>
                      </div>
                      {detailData.submission.submittedAt && (
                        <p className="mt-1 text-xs text-sky-800">
                          送出時間：{fmtLogTime(detailData.submission.submittedAt)}
                        </p>
                      )}
                      <div className="mt-3 space-y-2">
                        {(detailData.submission.answers ?? []).length === 0 ? (
                          <p className="text-sm text-gray-500">尚無答案內容</p>
                        ) : (
                          detailData.submission.answers.map(
                            (
                              a: {
                                id: string;
                                orderIndex: number;
                                questionTitle: string;
                                value: unknown;
                              },
                              index: number
                            ) => (
                              <div key={a.id} className="rounded-xl border border-white/90 bg-white px-3 py-3">
                                <div className="text-xs font-bold text-sky-700">第 {index + 1} 題</div>
                                <div className="mt-1 text-sm font-bold text-gray-900">{a.questionTitle}</div>
                                <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                                  {Array.isArray(a.value)
                                    ? a.value.join('、') || '未作答'
                                    : String(a.value ?? '未作答')}
                                </div>
                              </div>
                            )
                          )
                        )}
                      </div>
                    </section>
                  ) : (
                    <p className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                      此學生尚未開始填寫這份表單。
                    </p>
                  )}

                  <section>
                    <h3 className="mb-2 text-sm font-extrabold text-gray-900">操作紀錄</h3>
                    {!detailData.logs || detailData.logs.length === 0 ? (
                      <p className="text-sm text-gray-500">尚無紀錄</p>
                    ) : (
                      <ul className="space-y-2">
                        {detailData.logs.map(
                          (log: { id: string; actionType: string; detail: unknown; createdAt: string }) => (
                            <li key={log.id} className="rounded-xl border border-gray-200 bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-amber-800">{log.actionType}</span>
                                <span className="shrink-0 font-mono text-[10px] text-gray-500">
                                  {fmtLogTime(log.createdAt)}
                                </span>
                              </div>
                              {log.detail != null && (
                                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-2 text-[11px] text-gray-700">
                                  {JSON.stringify(log.detail)}
                                </pre>
                              )}
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
            <div className="border-t border-gray-100 p-3">
              <button
                type="button"
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
                onClick={() => setModal(null)}
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
