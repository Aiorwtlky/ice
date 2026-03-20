'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Megaphone, Trash2, Pencil, Eye, ArrowLeft } from 'lucide-react';
import { useGameLog } from '@/hooks/useGameLog';

const fetcher = (url: string) => fetch(url, { credentials: 'same-origin' }).then((r) => r.json());

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TeacherAnnouncementsPage() {
  const router = useRouter();
  const { sendLog } = useGameLog(null);
  const { data: meData } = useSWR<{ user?: { role: string; account: string } }>('/api/auth/me', fetcher);
  const { data: classesData } = useSWR<{ classes: { id: string; name: string }[] }>('/api/teacher/classes', fetcher);
  const classes = classesData?.classes ?? [];
  const [classId, setClassId] = useState('');
  useEffect(() => {
    if (classes.length && !classId) setClassId(classes[0].id);
  }, [classes, classId]);

  const listUrl = classId ? `/api/teacher/announcements?classGroupId=${classId}` : null;
  const { data: listData, mutate } = useSWR(listUrl, fetcher);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibleFrom, setVisibleFrom] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [visibleUntil, setVisibleUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [readsFor, setReadsFor] = useState<string | null>(null);
  const readsUrl = readsFor ? `/api/teacher/announcements/${readsFor}/reads` : null;
  const { data: readsData } = useSWR(readsUrl, fetcher);

  useEffect(() => {
    if (readsFor) {
      sendLog('ANNOUNCEMENT_READS_VIEW', { payload: { announcementId: readsFor } });
    }
  }, [readsFor, sendLog]);

  const announcements = listData?.announcements ?? [];

  useEffect(() => {
    if (!meData?.user) return;
    if (meData.user.role !== 'TEACHER' && meData.user.role !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [meData, router]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setVisibleFrom(toDatetimeLocalValue(new Date().toISOString()));
    setVisibleUntil('');
  };

  const startEdit = (a: (typeof announcements)[0]) => {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setVisibleFrom(toDatetimeLocalValue(a.visibleFrom));
    setVisibleUntil(a.visibleUntil ? toDatetimeLocalValue(a.visibleUntil) : '');
  };

  const submit = async () => {
    if (!classId || !title.trim() || !body.trim()) {
      alert('請選擇班級並填寫主旨、內文');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        classGroupId: classId,
        title: title.trim(),
        body: body.trim(),
        visibleFrom: new Date(visibleFrom).toISOString(),
        visibleUntil: visibleUntil ? new Date(visibleUntil).toISOString() : null,
      };
      if (editingId) {
        const res = await fetch(`/api/teacher/announcements/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: payload.title,
            body: payload.body,
            visibleFrom: payload.visibleFrom,
            visibleUntil: payload.visibleUntil,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || '更新失敗');
        }
      } else {
        const res = await fetch('/api/teacher/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || '建立失敗');
        }
      }
      await mutate();
      resetForm();
    } catch (e) {
      alert(e instanceof Error ? e.message : '錯誤');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('確定刪除此公告？')) return;
    const res = await fetch(`/api/teacher/announcements/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await mutate();
      if (editingId === id) resetForm();
    } else {
      const d = await res.json();
      alert(d.error || '刪除失敗');
    }
  };

  const fmt = useMemo(
    () => (iso: string) =>
      new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(iso)),
    []
  );

  if (!meData?.user) {
    return <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">載入中...</div>;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => router.push('/dashboard/teacher')}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> 返回老師儀表板
        </button>

        <div className="rounded-3xl border border-sky-200 bg-white p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Megaphone className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">班級公告</h1>
              <p className="text-sm text-gray-600">發布給你所負責的班級；學生於首頁選單查看，開啟時間會記錄。</p>
            </div>
          </div>

          <div className="mt-6">
            <label className="text-xs font-bold text-gray-500">班級</label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                resetForm();
              }}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500">主旨</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                placeholder="簡短標題"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500">內文</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="mt-1 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm"
                placeholder="公告內容（支援換行）"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-gray-500">顯示開始（台北時間）</label>
                <input
                  type="datetime-local"
                  value={visibleFrom}
                  onChange={(e) => setVisibleFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">截止（選填，截止後學生看不到）</label>
                <input
                  type="datetime-local"
                  value={visibleUntil}
                  onChange={(e) => setVisibleUntil(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={submit}
              className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
            >
              {editingId ? '儲存變更' : '發布公告'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-800">
                取消編輯
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-md">
          <h2 className="text-lg font-extrabold text-gray-900">已發布列表</h2>
          <ul className="mt-4 space-y-3">
            {announcements.length === 0 && <li className="text-sm text-gray-500">尚無公告</li>}
            {announcements.map(
              (a: {
                id: string;
                title: string;
                visibleFrom: string;
                visibleUntil: string | null;
                readCount: number;
                createdBy: { account: string };
              }) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900">{a.title}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {fmt(a.visibleFrom)}
                      {a.visibleUntil ? ` · 截止 ${fmt(a.visibleUntil)}` : ''} · 已讀 {a.readCount} 人 ·{' '}
                      {a.createdBy.account}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setReadsFor(a.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-900"
                    >
                      <Eye className="h-4 w-4" /> 誰看過
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
                    >
                      <Pencil className="h-4 w-4" /> 編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800"
                    >
                      <Trash2 className="h-4 w-4" /> 刪除
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        </div>
      </div>

      {readsFor && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setReadsFor(null)}
          role="presentation"
        >
          <div
            className="max-h-[min(80vh,28rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-gray-900">已讀學員</h3>
            <p className="mt-1 text-xs text-gray-500">首次開啟與最後開啟時間（伺服器時間）</p>
            <ul className="mt-4 space-y-2 text-sm">
              {(readsData?.reads ?? []).length === 0 && <li className="text-gray-500">尚無人開啟</li>}
              {(readsData?.reads ?? []).map(
                (r: {
                  account: string;
                  firstOpenedAt: string;
                  lastOpenedAt: string;
                  openCount: number;
                }) => (
                  <li key={r.account} className="rounded-xl border border-gray-100 px-3 py-2">
                    <div className="font-bold text-gray-900">{r.account}</div>
                    <div className="text-xs text-gray-600">
                      首次 {fmt(r.firstOpenedAt)} · 最後 {fmt(r.lastOpenedAt)} · 共 {r.openCount} 次
                    </div>
                  </li>
                )
              )}
            </ul>
            <button
              type="button"
              onClick={() => setReadsFor(null)}
              className="mt-4 w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
