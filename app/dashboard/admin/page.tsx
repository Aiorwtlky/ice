'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Building2, Users, BookOpen, ChevronDown, Search, UserCircle, GraduationCap, Layers, Pencil } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmtLogTime = (iso: string) => {
  const d = new Date(iso);
  const dt = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${dt}.${ms}`;
};

type AdminTab = 'teachers' | 'terms' | 'classes' | 'students' | 'logs';

const TERM_321_NAME = '3/21資訊教育';

async function ensure321Modules(
  terms: { id: string; name: string }[],
  onMutate: () => void | Promise<unknown>,
) {
  const safeJson = async (r: Response) => {
    try {
      return (await r.json()) as {
        error?: string;
        term?: { id: string; name: string };
        terms?: { id: string; name: string }[];
      };
    } catch {
      return {};
    }
  };

  let term = terms.find((t) => t.name === TERM_321_NAME);
  if (!term) {
    const r = await fetch('/api/admin/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name: TERM_321_NAME }),
    });
    const d = await safeJson(r);
    if (!r.ok) {
      alert(d.error || `建立分類失敗（${r.status}）`);
      return;
    }
    await onMutate();
    term = d.term ? { id: d.term.id, name: d.term.name } : undefined;
  }
  if (!term) {
    const r2 = await fetch('/api/admin/terms', { credentials: 'same-origin' });
    const d2 = await safeJson(r2);
    if (!r2.ok) {
      alert(d2.error || `無法讀取活動分類（${r2.status}）`);
      return;
    }
    term = (d2.terms ?? []).find((t) => t.name === TERM_321_NAME);
  }
  if (!term) {
    alert(`找不到「${TERM_321_NAME}」分類`);
    return;
  }

  const modules = [
    { code: 'HANOI_3', name: '三層的河內塔', description: '三層河內塔' },
    { code: 'HANOI_4', name: '四層的河內塔', description: '四層河內塔' },
    { code: 'HANOI_5', name: '五層的河內塔', description: '五層河內塔' },
    { code: 'HANOI_6', name: '六層的河內塔', description: '六層河內塔' },
    { code: 'HANOI_7', name: '七層的河內塔', description: '七層河內塔' },
    { code: 'HANOI_8', name: '八層的河內塔', description: '八層河內塔' },
    { code: 'MONSTER_GOBBLER', name: '怪獸大胃王', description: '餵食 push；腸胃順暢 shift（Queue）；反芻模式 pop（Stack）' },
    { code: 'BUBBLE_TEA_MASTER', name: '手搖飲大師', description: '狂加配料 push；粗吸管 shift（佇列）；長湯匙 pop（堆疊）' },
    { code: 'MAGIC_PANCAKE_TOWER', name: '魔法鬆餅塔', description: '堆疊 Stack：只能從頂部操作；push 疊上去、pop 拿走；Level 2 用備用盤子移走上層找目標' },
    { code: 'TEACH_STACK', name: '教學：Stack 堆疊', description: 'LIFO 動畫示範（Push / Pop）' },
    { code: 'TEACH_QUEUE', name: '教學：Queue 佇列', description: 'FIFO 動畫示範（Enqueue / Dequeue）' },
    { code: 'TEACH_HANOI_RECURSION', name: '教學：河內塔與遞迴', description: '河內塔步驟動畫 + Call Stack 視覺化' },
    { code: 'CLASS_ANNOUNCEMENTS', name: '班級公告', description: '老師發布公告、學生於選單閱讀；可設截止時間並記錄開啟時間' },
  ];

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const m of modules) {
    const r = await fetch('/api/admin/game-modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ termId: term.id, code: m.code, name: m.name, description: m.description }),
    });
    const d = await safeJson(r);
    if (r.ok) {
      created += 1;
      continue;
    }
    const msg = String(d.error ?? '');
    if (r.status === 409 || msg.includes('Unique') || msg.includes('已存在') || msg.includes('P2002')) {
      skipped += 1;
      continue;
    }
    errors.push(`${m.code}: ${msg || String(r.status)}`);
  }

  await onMutate();

  if (errors.length > 0) {
    alert(
      `部分失敗（${errors.length} 項）。新建 ${created}、略過 ${skipped}。\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n…' : ''}`,
    );
    return;
  }

  alert(
    `完成：${TERM_321_NAME} — 新建 ${created} 個模組，已存在略過 ${skipped} 個。\n含：河內塔 3–8、怪獸／手搖飲／鬆餅塔、教學 Stack／Queue／河內遞迴、班級公告（CLASS_ANNOUNCEMENTS）。`,
  );
}

interface ClassItem {
  id: string;
  name: string;
  schoolCode: string;
  termId: string | null;
  termName?: string;
  mainTeacher: { id: string; account: string; name: string | null };
  assignedTeachers: { id: string; account: string; name: string | null }[];
  studentCount: number;
}

interface TeacherRow {
  id: string;
  account: string;
  name: string | null;
  createdAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [tab, setTab] = useState<AdminTab>('classes');
  const [ensure321Busy, setEnsure321Busy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: meData } = useSWR<{ user?: { name: string; account: string; role: string } }>('/api/auth/me', fetcher);
  const user = meData?.user && meData.user.role === 'ADMIN' ? meData.user : null;
  const loading = !meData;
  const { data: classesData, mutate: mutateClasses } = useSWR<{ classes: ClassItem[] }>(user ? '/api/admin/classes' : null, fetcher);
  const { data: termsData, mutate: mutateTerms } = useSWR<{ terms: { id: string; name: string }[] }>(user ? '/api/admin/terms' : null, fetcher);
  const { data: usersData, mutate: mutateUsers } = useSWR<{ users: { id: string; account: string; name: string | null; role: string; createdAt: string }[] }>(user ? '/api/admin/users' : null, fetcher);

  useEffect(() => {
    if (!meData) return;
    if (!meData.user) { router.replace('/'); return; }
    if (meData.user.role !== 'ADMIN') { router.replace('/dashboard'); return; }
  }, [meData, router]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    if (showMenu) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showMenu]);

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]"><p className="text-gray-600">載入中...</p></div>;

  const classes = classesData?.classes ?? [];
  const termsRaw = termsData?.terms ?? [];
  const terms = Array.isArray(termsRaw) ? termsRaw.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })) : [];
  const teachers = (usersData?.users ?? []).filter((u) => u.role === 'TEACHER') as TeacherRow[];

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); } catch { router.push('/'); }
  };

  const runEnsure321 = async () => {
    if (ensure321Busy) return;
    setEnsure321Busy(true);
    try {
      await ensure321Modules(terms, mutateTerms);
    } catch (e) {
      console.error('ensure321', e);
      alert(e instanceof Error ? `執行失敗：${e.message}` : '執行失敗');
    } finally {
      setEnsure321Busy(false);
    }
  };

  return (
    <div className="flex h-screen min-h-[480px] flex-col overflow-hidden bg-[#FDFBF7]">
      <div className="flowing-bg" aria-hidden="true">
        <div className="tech-blob tech-blob-1" />
        <div className="tech-blob tech-blob-2" />
        <div className="tech-blob tech-blob-3" />
      </div>

      <header className="z-50 w-full shrink-0 border-b bg-white/90 shadow-sm backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
          <h1 className="text-lg font-bold text-black md:text-xl lg:text-2xl">NovaInsight 資訊科普教育平台</h1>
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100">
              <span className="text-base text-black">{user.account}</span>
              <svg className={`h-4 w-4 text-gray-600 transition-transform ${showMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <div className="border-b border-gray-200 px-4 py-2">
                  <p className="text-sm font-medium text-gray-900">{user.account}</p>
                  <p className="text-xs text-gray-500">管理員</p>
                </div>
                <button type="button" onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">登出</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 lg:overflow-hidden lg:flex lg:items-center lg:justify-center">
        <div className="mx-auto grid w-full max-w-7xl min-h-0 gap-6 lg:h-full lg:grid-cols-12 items-stretch">
          <div className="relative z-10 rounded-2xl border border-gray-200/60 bg-white/90 p-5 shadow-lg backdrop-blur-sm min-h-0 lg:col-span-4 lg:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700"><UserCircle className="h-6 w-6" /></div>
              <div>
                <p className="text-sm text-gray-500">管理員</p>
                <p className="font-semibold text-gray-900">{user.name ?? user.account}</p>
                <p className="text-xs text-gray-400">{user.account}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-sm">
              <div><p className="text-gray-500">講師數</p><p className="text-lg font-bold text-gray-900">{teachers.length}</p></div>
              <div><p className="text-gray-500">班級數</p><p className="text-lg font-bold text-gray-900">{classes.length}</p></div>
            </div>
            <button
              type="button"
              onClick={() => router.push('/dashboard/competitions')}
              className="mt-4 w-full rounded-xl border border-violet-300 bg-violet-50 py-2.5 text-sm font-bold text-violet-900 hover:bg-violet-100"
            >
              班級競賽管理
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/admin/announcements')}
              className="mt-2 w-full rounded-xl border border-sky-300 bg-sky-50 py-2.5 text-sm font-bold text-sky-900 hover:bg-sky-100"
            >
              班級公告（全平台）
            </button>
            <button
              type="button"
              disabled={ensure321Busy}
              onClick={runEnsure321}
              className="mt-2 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {ensure321Busy ? '一鍵建立中…' : '一鍵新增 3/21 模組（河內塔、遊戲、班級公告）'}
            </button>
            <p className="mt-1.5 text-xs text-gray-500">不需切換分頁；完成後也可到「活動分類」查看列表。</p>
          </div>

          <div className="relative z-10 rounded-2xl border border-gray-200/60 bg-white/90 p-5 shadow-lg backdrop-blur-sm min-h-0 flex flex-col lg:col-span-8 lg:p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {([
                ['teachers', GraduationCap, '講師帳號'],
                ['terms', Layers, '活動分類'],
                ['classes', Building2, '班級管理'],
                ['students', Users, '學生帳號'],
                ['logs', BookOpen, '學習歷程'],
              ] as const).map(([t, Icon, label]) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition md:px-4 ${tab === t ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  <Icon className="h-4 w-4 shrink-0" />{label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {tab === 'teachers' && <TeachersTab teachers={teachers} onMutate={mutateUsers} />}
              {tab === 'terms' && (
                <TermsTab terms={terms} onMutate={mutateTerms} onEnsure321={runEnsure321} ensure321Busy={ensure321Busy} />
              )}
              {tab === 'classes' && <ClassesTab classes={classes} terms={terms} teachers={teachers} onMutate={() => { mutateClasses(); mutateUsers(); }} />}
              {tab === 'students' && <StudentsTab classes={classes} onMutate={mutateClasses} />}
              {tab === 'logs' && <LearningLogsTab classes={classes} />}
            </div>
          </div>
        </div>
      </main>

      <footer className="shrink-0 border-t border-gray-200/80 bg-white/95 py-3 backdrop-blur-sm">
        <div className="space-y-0.5 text-center text-sm text-gray-500">
          <p>教育部帶動中小學計畫</p>
          <p>Google Developer Groups on Campus NTUB</p>
          <p className="text-xs text-gray-400">© 2026</p>
        </div>
      </footer>
    </div>
  );
}

function TeachersTab({ teachers, onMutate }: { teachers: TeacherRow[]; onMutate: () => void }) {
  const [addOpen, setAddOpen] = useState(false);
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const sorted = useMemo(() => [...teachers].sort((a, b) => a.account.localeCompare(b.account, 'zh-Hant')), [teachers]);

  const createTeacher = async () => {
    if (!account.trim() || !password) { alert('請填帳號與密碼'); return; }
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: account.trim(), name: name.trim() || account.trim(), password, role: 'TEACHER' }) });
    const d = await res.json();
    if (res.ok) { setAddOpen(false); setAccount(''); setName(''); setPassword(''); onMutate(); } else alert(d.error || '失敗');
  };

  const saveEdit = async () => {
    if (!editId) return;
    const res = await fetch(`/api/admin/teachers/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName, password: editPassword || undefined }) });
    const d = await res.json();
    if (res.ok) { setEditId(null); onMutate(); } else alert(d.error || '失敗');
  };

  const delTeacher = async (id: string) => {
    if (!confirm('確定刪除此講師帳號？（須非任何班主講師）')) return;
    const res = await fetch(`/api/admin/teachers/${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (res.ok) onMutate(); else alert(d.error || '失敗');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">講師帳號（增刪改查）</h2>
        <button type="button" onClick={() => setAddOpen(true)} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600">新增講師</button>
      </div>
      <p className="text-sm text-gray-600">主講師：各班負責人；協同講師：由「班級管理」加入，可與主講師不同人。</p>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50 text-left"><th className="p-3">帳號</th><th className="p-3">姓名</th><th className="p-3">建立時間</th><th className="p-3 text-right">操作</th></tr></thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id} className="border-b last:border-b-0 hover:bg-gray-50">
                <td className="p-3 font-mono font-medium">{t.account}</td>
                <td className="p-3">{t.name ?? '—'}</td>
                <td className="p-3 text-gray-600">{new Date(t.createdAt).toLocaleString('zh-TW')}</td>
                <td className="p-3 text-right">
                  <button type="button" onClick={() => { setEditId(t.id); setEditName(t.name ?? ''); setEditPassword(''); }} className="mr-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200">編輯</button>
                  <button type="button" onClick={() => delTeacher(t.id)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100">刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold">新增講師</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">帳號</label><input value={account} onChange={(e) => setAccount(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" /></div>
              <div><label className="text-xs text-gray-500">姓名（顯示用）</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="可與帳號相同" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" /></div>
              <div><label className="text-xs text-gray-500">密碼</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" /></div>
            </div>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setAddOpen(false)} className="flex-1 rounded-xl border py-2.5 text-sm">取消</button>
              <button type="button" onClick={createTeacher} className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white">建立</button>
            </div>
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditId(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold">編輯講師</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">姓名</label><input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" /></div>
              <div><label className="text-xs text-gray-500">新密碼（留空則不變）</label><input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" /></div>
            </div>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setEditId(null)} className="flex-1 rounded-xl border py-2.5 text-sm">取消</button>
              <button type="button" onClick={saveEdit} className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TermsTab({
  terms,
  onMutate,
  onEnsure321,
  ensure321Busy,
}: {
  terms: { id: string; name: string }[];
  onMutate: () => void;
  onEnsure321: () => void | Promise<void>;
  ensure321Busy: boolean;
}) {
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    const res = await fetch('/api/admin/terms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) });
    if (res.ok) { setName(''); onMutate(); } else alert((await res.json()).error);
  };

  const save = async () => {
    if (!editId || !editName.trim()) return;
    const res = await fetch(`/api/admin/terms/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName.trim() }) });
    if (res.ok) { setEditId(null); onMutate(); } else alert((await res.json()).error);
  };

  const del = async (id: string) => {
    if (!confirm('確定刪除此活動分類？')) return;
    const res = await fetch(`/api/admin/terms/${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (res.ok) onMutate(); else alert(d.error || '刪除失敗');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-gray-900">活動分類（與創班級分開；用於掛活動模組、可選綁班級）</h2>
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="新分類名稱" className="rounded-xl border px-4 py-2.5 text-sm w-48" />
        <button type="button" onClick={add} className="rounded-xl bg-gray-700 px-4 py-2.5 text-sm font-bold text-white">新增分類</button>
        <button type="button" onClick={() => window.location.href = '/dashboard/forms'} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-800">管理表單活動</button>
        <button type="button" onClick={() => window.location.href = '/dashboard/forms/new'} className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-800">新增表單活動</button>
        <button
          type="button"
          disabled={ensure321Busy}
          onClick={() => void onEnsure321()}
          className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {ensure321Busy ? '一鍵建立中…' : '一鍵新增 3/21 模組（左欄也可按）'}
        </button>
      </div>
      <div className="rounded-xl border border-gray-200 divide-y">
        {terms.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <span className="font-semibold text-gray-900">{t.name}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setEditId(t.id); setEditName(t.name); }} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium">改名</button>
              <button type="button" onClick={() => del(t.id)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600">刪除</button>
            </div>
          </div>
        ))}
      </div>
      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditId(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-bold">重新命名</h3>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="mb-4 w-full rounded-xl border px-3 py-2.5 text-sm" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditId(null)} className="flex-1 rounded-xl border py-2">取消</button>
              <button type="button" onClick={save} className="flex-1 rounded-xl bg-amber-500 py-2 font-bold text-white">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassesTab({
  classes,
  terms,
  teachers,
  onMutate,
}: {
  classes: ClassItem[];
  terms: { id: string; name: string }[];
  teachers: TeacherRow[];
  onMutate: () => void;
}) {
  const [name, setName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignAction, setAssignAction] = useState<'add' | 'remove'>('add');
  const [editClassId, setEditClassId] = useState<string | null>(null);
  const [editMainTeacherId, setEditMainTeacherId] = useState('');
  const [editTermId, setEditTermId] = useState<string | null>(null);

  const createClass = async () => {
    if (!name.trim() || !schoolCode.trim() || !teacherId) { alert('請填班級名稱、代碼並選主講師'); return; }
    const res = await fetch('/api/admin/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), schoolCode: schoolCode.trim(), teacherId }) });
    if (res.ok) { setName(''); setSchoolCode(''); setTeacherId(''); onMutate(); } else alert((await res.json()).error);
  };

  const assignCollaborator = async () => {
    if (!assignClassId || !assignUserId) { alert('請選班級與講師'); return; }
    const res = await fetch(`/api/admin/classes/${assignClassId}/teachers`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: assignUserId, action: assignAction }) });
    if (res.ok) onMutate(); else alert((await res.json()).error);
  };

  const openEditClass = (c: ClassItem) => {
    setEditClassId(c.id);
    setEditMainTeacherId(c.mainTeacher.id);
    setEditTermId(c.termId ?? null);
  };

  const saveClassEdit = async () => {
    if (!editClassId) return;
    const res = await fetch(`/api/admin/classes/${editClassId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: editMainTeacherId, activeTermId: editTermId === '' ? null : editTermId }) });
    if (res.ok) { setEditClassId(null); onMutate(); } else alert((await res.json()).error);
  };

  const fmtTeacher = (u: { account: string; name: string | null }) => `${u.account}（${u.name ?? '未填姓名'}）`;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-gray-900">創立班級</h2>
        <p className="mb-3 text-sm text-gray-600">只需班級名稱、代碼、<strong>主講師</strong>。活動分類請在下方班級列表「編輯班級」中綁定（選用）。</p>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div><label className="text-xs text-gray-500">班級名稱</label><input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" /></div>
          <div><label className="text-xs text-gray-500">班級代碼</label><input value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" /></div>
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">主講師</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {teachers.map((u) => (
            <button key={u.id} type="button" onClick={() => setTeacherId(u.id)} className={`rounded-xl border-2 px-4 py-2 text-sm font-medium ${teacherId === u.id ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 bg-gray-50'}`}>{fmtTeacher(u)}</button>
          ))}
        </div>
        <button type="button" onClick={createClass} className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white">建立班級</button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-gray-900">協同講師（班級內額外可協作的講師帳號）</h2>
        <p className="mb-3 text-sm text-gray-600">主講師已於創班時指定；此處加入的是<strong>協同講師</strong>（可多選帳號加入同一班）。</p>
        <p className="mb-2 text-xs font-bold text-gray-500">班級</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {classes.map((c) => (
            <button key={c.id} type="button" onClick={() => setAssignClassId(c.id)} className={`rounded-xl border-2 px-4 py-2 text-sm ${assignClassId === c.id ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 bg-gray-50'}`}>{c.name}</button>
          ))}
        </div>
        <p className="mb-2 text-xs font-bold text-gray-500">講師</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {teachers.map((u) => (
            <button key={u.id} type="button" onClick={() => setAssignUserId(u.id)} className={`rounded-xl border-2 px-3 py-2 text-sm ${assignUserId === u.id ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 bg-gray-50'}`}>{fmtTeacher(u)}</button>
          ))}
        </div>
        <div className="mb-3 flex gap-2">
          <button type="button" onClick={() => setAssignAction('add')} className={`rounded-xl px-4 py-2 text-sm font-bold ${assignAction === 'add' ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>加入協同講師</button>
          <button type="button" onClick={() => setAssignAction('remove')} className={`rounded-xl px-4 py-2 text-sm font-bold ${assignAction === 'remove' ? 'bg-red-600 text-white' : 'bg-gray-100'}`}>移除協同講師</button>
        </div>
        <button type="button" onClick={assignCollaborator} className="rounded-xl bg-gray-700 px-5 py-2.5 text-sm font-bold text-white">執行</button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-gray-900">班級總覽</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[1100px] text-sm">
            <thead><tr className="border-b bg-gray-50 text-left">
              <th className="p-3 whitespace-nowrap">班級</th>
              <th className="p-3 whitespace-nowrap">代碼</th>
              <th className="p-3 whitespace-nowrap">主講師</th>
              <th className="p-3 whitespace-nowrap">協同講師</th>
              <th className="p-3 whitespace-nowrap">綁定活動分類</th>
              <th className="p-3 whitespace-nowrap">學員數</th>
              <th className="p-3 whitespace-nowrap">操作</th>
            </tr></thead>
            <tbody>
              {classes.map((c) => {
                const collab = c.assignedTeachers.filter((t) => t.id !== c.mainTeacher.id);
                return (
                  <tr key={c.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="p-3 font-medium whitespace-nowrap">{c.name}</td>
                    <td className="p-3 whitespace-nowrap">{c.schoolCode}</td>
                    <td className="p-3 whitespace-nowrap">{fmtTeacher(c.mainTeacher)}</td>
                    <td className="p-3 whitespace-nowrap">{collab.length ? collab.map((t) => fmtTeacher(t)).join('、') : <span className="text-gray-400">尚無</span>}</td>
                    <td className="p-3 whitespace-nowrap">{c.termName ?? <span className="text-gray-400">未綁定</span>}</td>
                    <td className="p-3 whitespace-nowrap">{c.studentCount}</td>
                    <td className="p-3 whitespace-nowrap">
                      <button type="button" onClick={() => openEditClass(c)} className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"><Pencil className="h-3 w-3" />編輯</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editClassId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditClassId(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold">編輯班級</h3>
            <p className="mb-2 text-xs font-bold text-gray-500">變更主講師</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {teachers.map((u) => (
                <button key={u.id} type="button" onClick={() => setEditMainTeacherId(u.id)} className={`rounded-xl border-2 px-3 py-2 text-xs ${editMainTeacherId === u.id ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200'}`}>{fmtTeacher(u)}</button>
              ))}
            </div>
            <p className="mb-2 text-xs font-bold text-gray-500">綁定活動分類（可選，供該班使用模組脈絡）</p>
            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditTermId(null)} className={`rounded-xl border-2 px-3 py-2 text-sm ${editTermId === null ? 'border-gray-700 bg-gray-800 text-white' : 'border-gray-200'}`}>不綁定</button>
              {terms.map((t) => (
                <button key={t.id} type="button" onClick={() => setEditTermId(t.id)} className={`rounded-xl border-2 px-3 py-2 text-sm ${editTermId === t.id ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200'}`}>{t.name}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditClassId(null)} className="flex-1 rounded-xl border py-2.5">取消</button>
              <button type="button" onClick={saveClassEdit} className="flex-1 rounded-xl bg-amber-500 py-2.5 font-bold text-white">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentsTab({ classes, onMutate }: { classes: ClassItem[]; onMutate: () => void }) {
  const [classId, setClassId] = useState('');
  const [singleModal, setSingleModal] = useState(false);
  const [singleAccount, setSingleAccount] = useState('');
  const [singlePassword, setSinglePassword] = useState('');
  const [batchModal, setBatchModal] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [startFrom, setStartFrom] = useState(1);
  const [batchCount, setBatchCount] = useState(30);
  const [defaultPassword, setDefaultPassword] = useState('88');
  const [resetModalUserId, setResetModalUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const { data: studentsData, mutate: mutateStudents } = useSWR<{ students: { id: string; account: string; name: string | null }[] }>(classId ? `/api/class-groups/${classId}/students` : null, fetcher);
  const students = studentsData?.students ?? [];
  const studentsSorted = useMemo(() => [...students].sort((a, b) => a.account.localeCompare(b.account, 'zh-Hant')), [students]);

  const addOne = async () => {
    if (!classId || !singleAccount.trim() || !singlePassword) { alert('請選班級並填帳密'); return; }
    const res = await fetch(`/api/class-groups/${classId}/students`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: singleAccount.trim(), password: singlePassword }) });
    const data = await res.json();
    if (res.ok) { setSingleModal(false); setSingleAccount(''); setSinglePassword(''); mutateStudents(); onMutate(); } else alert(data.error);
  };

  const batchCreate = async () => {
    if (!classId) return;
    const res = await fetch(`/api/class-groups/${classId}/students/batch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: prefix || undefined, startFrom, count: batchCount, defaultPassword }) });
    const data = await res.json();
    if (res.ok) { setBatchModal(false); mutateStudents(); onMutate(); alert(data.created?.length ? `已建立 ${data.created.length} 筆` : '完成'); } else alert(data.error);
  };

  const resetPw = async () => {
    if (!resetModalUserId || !newPassword) return;
    const res = await fetch(`/api/admin/students/${resetModalUserId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: newPassword }) });
    if (res.ok) { setResetModalUserId(null); setNewPassword(''); } else alert((await res.json()).error);
  };

  const deleteStudent = async (userId: string) => {
    if (!confirm('確定刪除？')) return;
    const res = await fetch(`/api/admin/students/${userId}`, { method: 'DELETE' });
    if (res.ok) mutateStudents(); else alert((await res.json()).error);
  };

  const previewAccounts = classId ? Array.from({ length: Math.min(batchCount, 50) }, (_, i) => `${prefix || (classes.find((c) => c.id === classId)?.schoolCode ?? '')}-${String(startFrom + i).padStart(2, '0')}`) : [];

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-gray-500">選擇班級</p>
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <button key={c.id} type="button" onClick={() => setClassId(c.id)} className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold ${classId === c.id ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 bg-gray-50'}`}>{c.name}</button>
        ))}
      </div>
      {classId && (
        <>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSingleModal(true)} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white">單一新增</button>
            <button type="button" onClick={() => setBatchModal(true)} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white">批次生成</button>
          </div>
          {singleModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSingleModal(false)}>
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <input value={singleAccount} onChange={(e) => setSingleAccount(e.target.value)} placeholder="帳號" className="mb-2 w-full rounded-xl border px-3 py-2 text-sm" />
                <input type="password" value={singlePassword} onChange={(e) => setSinglePassword(e.target.value)} placeholder="密碼" className="mb-4 w-full rounded-xl border px-3 py-2 text-sm" />
                <div className="flex gap-2"><button type="button" onClick={() => setSingleModal(false)} className="flex-1 rounded-xl border py-2">取消</button><button type="button" onClick={addOne} className="flex-1 rounded-xl bg-amber-500 py-2 text-white">確認</button></div>
              </div>
            </div>
          )}
          {batchModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setBatchModal(false)}>
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="前綴" className="mb-2 w-full rounded-xl border px-3 py-2 text-sm" />
                <div className="mb-2 grid grid-cols-2 gap-2"><input type="number" value={startFrom} onChange={(e) => setStartFrom(Number(e.target.value) || 1)} className="rounded-xl border px-3 py-2 text-sm" /><input type="number" value={batchCount} onChange={(e) => setBatchCount(Number(e.target.value) || 1)} className="rounded-xl border px-3 py-2 text-sm" /></div>
                <p className="mb-4 text-xs text-gray-600">預覽：{previewAccounts.slice(0, 8).join('、')}</p>
                <div className="flex gap-2"><button type="button" onClick={() => setBatchModal(false)} className="flex-1 rounded-xl border py-2">取消</button><button type="button" onClick={batchCreate} className="flex-1 rounded-xl bg-amber-500 py-2 text-white">確認</button></div>
              </div>
            </div>
          )}
          <div className="max-h-[320px] overflow-y-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50"><tr className="border-b"><th className="p-3 text-left">帳號</th><th className="p-3 text-left">姓名</th><th className="p-3 text-right">操作</th></tr></thead>
              <tbody>
                {studentsSorted.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{s.account}</td>
                    <td className="p-3">{s.name ?? '—'}</td>
                    <td className="p-3 text-right">
                      <button type="button" onClick={() => { setResetModalUserId(s.id); setNewPassword(''); }} className="mr-2 text-xs text-gray-700">重置密碼</button>
                      <button type="button" onClick={() => deleteStudent(s.id)} className="text-xs text-red-600">刪除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resetModalUserId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResetModalUserId(null)}>
              <div className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="新密碼" className="mb-4 w-full rounded-xl border px-3 py-2" />
                <div className="flex gap-2"><button type="button" onClick={() => setResetModalUserId(null)} className="flex-1 rounded-xl border py-2">取消</button><button type="button" onClick={resetPw} className="flex-1 rounded-xl bg-gray-700 py-2 text-white">確認</button></div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LearningLogsTab({ classes }: { classes: ClassItem[] }) {
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [logScope, setLogScope] = useState<'all' | 'single'>('all');
  const [logStudentId, setLogStudentId] = useState('');
  const [logSearch, setLogSearch] = useState('');

  const { data: studentsData } = useSWR<{ students: { id: string; account: string; name: string | null }[] }>(classFilter ? `/api/class-groups/${classFilter}/students` : null, fetcher);
  const students = studentsData?.students ?? [];
  const studentsSorted = useMemo(() => [...students].sort((a, b) => a.account.localeCompare(b.account, 'zh-Hant')), [students]);

  const logsUrl = useMemo(() => {
    if (logScope === 'single' && classFilter) {
      const uid = logStudentId || studentsSorted[0]?.id;
      if (!uid) return null;
      return `/api/admin/learning-logs?userId=${uid}`;
    }
    if (classFilter) return `/api/admin/learning-logs?classGroupId=${classFilter}`;
    return '/api/admin/learning-logs';
  }, [classFilter, logScope, logStudentId, studentsSorted]);

  const { data: logsData } = useSWR<{ logs: { id: string; actionType: string; detail: unknown; createdAt: string; user: { account: string; name: string | null }; gameModule: { code: string; name: string } | null }[] }>(logsUrl, fetcher);
  const logs = logsData?.logs ?? [];

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const timeStr = fmtLogTime(l.createdAt).toLowerCase();
      const detailStr = typeof l.detail === 'object' && l.detail ? JSON.stringify(l.detail) : String(l.detail ?? '');
      return [timeStr, l.actionType, l.user?.account, l.user?.name, l.gameModule?.code, l.gameModule?.name, detailStr].join(' ').toLowerCase().includes(q);
    });
  }, [logs, logSearch]);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-gray-900">學習歷程（已串資料庫）</h2>
      <p className="text-sm text-gray-600">不選班級時顯示<strong>全平台學員</strong>最近紀錄；選班級則僅該班學員。</p>
      <p className="text-xs font-bold text-gray-500">篩選班級（選「全部」看全系統）</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setClassFilter(null); setLogScope('all'); setLogStudentId(''); }} className={`rounded-xl border-2 px-4 py-2 text-sm font-semibold ${classFilter === null ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 bg-gray-50'}`}>全部學員</button>
        {classes.map((c) => (
          <button key={c.id} type="button" onClick={() => { setClassFilter(c.id); setLogScope('all'); setLogStudentId(''); }} className={`rounded-xl border-2 px-4 py-2 text-sm font-semibold ${classFilter === c.id ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 bg-gray-50'}`}>{c.name}</button>
        ))}
      </div>
      {classFilter && studentsSorted.length > 0 && (
        <>
          <div className="flex gap-2">
            <button type="button" onClick={() => setLogScope('all')} className={`rounded-xl px-4 py-2 text-sm font-bold ${logScope === 'all' ? 'bg-amber-500 text-white' : 'bg-gray-100'}`}>該班全班</button>
            <button type="button" onClick={() => { setLogScope('single'); if (!logStudentId && studentsSorted[0]) setLogStudentId(studentsSorted[0].id); }} className={`rounded-xl px-4 py-2 text-sm font-bold ${logScope === 'single' ? 'bg-amber-500 text-white' : 'bg-gray-100'}`}>單一學員</button>
          </div>
          {logScope === 'single' && (
            <div className="flex flex-wrap gap-2">
              {studentsSorted.map((s) => (
                <button key={s.id} type="button" onClick={() => setLogStudentId(s.id)} className={`rounded-full border-2 px-4 py-2 text-sm ${(logStudentId || studentsSorted[0]?.id) === s.id ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 bg-gray-50'}`}>{s.account}</button>
              ))}
            </div>
          )}
        </>
      )}
      <div className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3">
        <Search className="h-5 w-5 text-gray-400" />
        <input value={logSearch} onChange={(e) => setLogSearch(e.target.value)} placeholder="搜尋時間、帳號、動作、遊戲、內容…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="max-h-[400px] overflow-y-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50"><tr className="border-b text-left"><th className="p-3">時間</th><th className="p-3">學員</th><th className="p-3">類型</th><th className="p-3">遊戲</th><th className="p-3">內容</th></tr></thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id} className="border-b hover:bg-gray-50">
                <td className="p-3 whitespace-nowrap text-gray-700">{fmtLogTime(log.createdAt)}</td>
                <td className="p-3">{log.user?.account} {log.user?.name ?? ''}</td>
                <td className="p-3">{log.actionType}</td>
                <td className="p-3">{log.gameModule?.name ?? log.gameModule?.code ?? '—'}</td>
                <td className="p-3 max-w-[200px] truncate">{log.detail ? JSON.stringify(log.detail) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filteredLogs.length && <p className="text-center text-sm text-gray-500">尚無紀錄或載入中…</p>}
    </div>
  );
}
