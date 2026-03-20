'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { BarChart3, ClipboardList, FilePenLine, Plus, Search } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface FormListItem {
  id: string;
  title: string;
  description: string | null;
  allowMultipleSubmissions: boolean;
  allowEditAfterSubmit: boolean;
  allowViewAfterSubmit: boolean;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  createdBy: { id: string; account: string; name: string | null };
  gameModule: {
    id: string;
    code: string;
    name: string;
    termId: string;
    term: { id: string; name: string };
  };
  questionCount: number;
  submissionCount: number;
}

export default function FormDashboardPage() {
  const router = useRouter();
  const { data: meData, isLoading: authLoading } = useSWR<{ user?: { role: string } }>(
    '/api/auth/me',
    fetcher
  );
  const { data, isLoading } = useSWR<{ forms: FormListItem[] }>('/api/form-activities', fetcher);
  const [search, setSearch] = useState('');
  const forms = useMemo(() => data?.forms ?? [], [data?.forms]);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return forms;
    return forms.filter(
      (form) =>
        form.title.toLowerCase().includes(keyword) ||
        form.gameModule.code.toLowerCase().includes(keyword) ||
        form.gameModule.term.name.toLowerCase().includes(keyword) ||
        (form.description ?? '').toLowerCase().includes(keyword)
    );
  }, [forms, search]);

  const user = meData?.user;
  const roleOk = user && (user.role === 'TEACHER' || user.role === 'ADMIN');
  if (!authLoading && !roleOk) {
    router.replace('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold text-amber-700">NovaInsight 資訊科普教育平台</p>
              <h1 className="mt-2 text-3xl font-black text-gray-900">表單活動管理</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                這裡會列出所有表單活動。只有建立者與管理員可編輯，但老師仍可查看其他表單設定與使用情況。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push('/dashboard/forms/new')}
                className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-amber-200"
              >
                <Plus className="mr-1 inline h-4 w-4" />
                新增表單
              </button>
              <button
                type="button"
                onClick={() => router.push(user?.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/teacher')}
                className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700"
              >
                返回控制台
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-gray-900">
              <ClipboardList className="h-5 w-5 text-amber-600" />
              <h2 className="text-xl font-black">所有表單</h2>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋名稱、分類、代碼"
                className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {isLoading ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-500">
                載入表單中...
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-500">
                目前沒有符合條件的表單
              </div>
            ) : (
              filtered.map((form) => (
                <article
                  key={form.id}
                  className="flex h-full flex-col rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
                        {form.gameModule.term.name}
                      </p>
                      <h3 className="mt-2 line-clamp-2 text-xl font-black text-gray-900">{form.title}</h3>
                    </div>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-600">
                      {form.gameModule.code}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-gray-600">
                    {form.description || '未填寫表單說明'}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-amber-50 p-4 text-sm">
                    <div>
                      <p className="text-gray-500">題數</p>
                      <p className="text-lg font-black text-gray-900">{form.questionCount}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">提交數</p>
                      <p className="text-lg font-black text-gray-900">{form.submissionCount}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1">
                      {form.allowMultipleSubmissions ? '可重複提交' : '限一次提交'}
                    </span>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1">
                      {form.allowEditAfterSubmit ? '可改答案' : '送出後鎖定'}
                    </span>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1">
                      {form.allowViewAfterSubmit ? '可看已送內容' : '不可看已送內容'}
                    </span>
                  </div>

                  <div className="mt-4 text-xs leading-5 text-gray-500">
                    建立者：{form.createdBy.name ?? form.createdBy.account}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/forms/${form.id}/responses`}
                      className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-900 hover:bg-sky-100"
                    >
                      <BarChart3 className="mr-1 inline h-4 w-4" />
                      填答狀況
                    </Link>
                    <Link
                      href={`/dashboard/forms/${form.id}/edit`}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-bold ${
                        form.canEdit
                          ? 'bg-amber-500 text-white'
                          : 'border border-gray-200 bg-gray-50 text-gray-500'
                      }`}
                    >
                      <FilePenLine className="mr-1 inline h-4 w-4" />
                      {form.canEdit ? '編輯表單' : '只能查看'}
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
