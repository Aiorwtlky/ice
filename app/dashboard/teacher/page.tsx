'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { User, Building2, Gamepad2, Users, ClipboardList, Eye, Lock, Unlock, ChevronDown, ChevronRight, Search, ArrowUpDown, MonitorPlay, Trophy } from 'lucide-react';

interface UserInfo {
  id: string;
  name: string;
  account: string;
  role: string;
}

interface TeacherClass {
  id: string;
  name: string;
  schoolCode: string | null;
  activeTerm: { id: string; name: string } | null;
  teacher: { id: string; account: string; name: string };
  _count: { students: number };
}

interface UnlockItem {
  unlockId: string | null;
  gameModuleId: string;
  gameCode: string;
  gameName: string;
  isUnlocked: boolean;
}

interface StatusData {
  classGroup: { id: string; name: string; loginLocked?: boolean };
  sessions?: { id: string; name: string; sessionAt: string | null; order: number }[];
  session?: { id: string; name: string };
  unlocks: UnlockItem[];
}

interface LearningLogEntry {
  id: string;
  actionType: string;
  detail: unknown;
  createdAt: string;
  user?: { id?: string; account: string; name: string | null };
  gameModule?: { code: string; name: string };
}

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

type Tab = 'control' | 'students' | 'logs';

export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('control');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [nextLoading, setNextLoading] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSort, setStudentSort] = useState<'account_asc' | 'account_desc'>('account_asc');
  const [filterGender, setFilterGender] = useState<{ 男生: boolean; 女生: boolean }>({ 男生: false, 女生: false });
  const [filterGrade, setFilterGrade] = useState<{ 三年級: boolean; 四年級: boolean; 五年級: boolean; 六年級: boolean }>({ 三年級: false, 四年級: false, 五年級: false, 六年級: false });

  const [logScope, setLogScope] = useState<'all' | 'single'>('all');
  const [logStudentId, setLogStudentId] = useState<string>('');
  const [logSearch, setLogSearch] = useState('');
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [lockSaving, setLockSaving] = useState(false);
  const [toggleSavingIds, setToggleSavingIds] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: teacherClassesData } = useSWR<{ classes: TeacherClass[] }>('/api/teacher/classes', fetcher);
  const teacherClasses = teacherClassesData?.classes ?? [];
  const classId = teacherClasses[0]?.id ?? '';

  const statusUrl = classId
    ? sessionId
      ? `/api/games/status?classGroupId=${classId}&sessionId=${sessionId}`
      : `/api/games/status?classGroupId=${classId}`
    : null;
  const { data, error, isLoading, mutate } = useSWR<StatusData & { error?: string }>(statusUrl, fetcher, { refreshInterval: 0 });
  const status = data as StatusData | undefined;
  const effectiveSessionId = sessionId ?? status?.sessions?.[0]?.id ?? null;

  const { data: studentsData, mutate: mutateStudents } = useSWR<{ students: { id: string; account: string; name: string | null; gender?: string | null; grade?: string | null; onboardingDone?: boolean }[] }>(
    classId ? `/api/class-groups/${classId}/students` : null,
    fetcher
  );
  const { data: openSummary, mutate: mutateOpen } = useSWR<{
    openActivities?: { gameModuleId: string; gameCode: string; gameName: string }[];
  }>(classId ? `/api/games/status?classGroupId=${classId}&openSummary=1` : null, fetcher);

  const studentsSorted = useMemo(
    () => [...(studentsData?.students ?? [])].sort((a, b) => a.account.localeCompare(b.account, 'zh-Hant')),
    [studentsData?.students]
  );
  const activeLogStudentId =
    logScope === 'single' ? (logStudentId || studentsSorted[0]?.id || '') : '';

  const { data: logsData, mutate: mutateLogs } = useSWR<{ logs: LearningLogEntry[] }>(() => {
    if (!classId) return null;
    if (logScope === 'single' && !activeLogStudentId) return null;
    const u = logScope === 'single' ? `&userId=${activeLogStudentId}` : '';
    return `/api/teacher/learning-logs?classGroupId=${classId}${u}`;
  }, fetcher);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) { router.replace('/'); return; }
        if (data.user.role !== 'TEACHER' && data.user.role !== 'ADMIN') { router.replace('/dashboard'); return; }
          setUser(data.user);
      })
      .catch(() => router.replace('/'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); } catch { router.push('/'); }
  };

  const handleSetUnlock = async (item: UnlockItem, classGroupId: string, isUnlocked: boolean) => {
    if (!effectiveSessionId) return;
    if (toggleSavingIds[item.gameModuleId]) return;
    if (item.isUnlocked === isUnlocked) return;
    setToggleSavingIds((m) => ({ ...m, [item.gameModuleId]: true }));
    const res = await fetch('/api/games/status', {
        method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classGroupId, gameModuleId: item.gameModuleId, isUnlocked }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      mutate();
      mutateOpen();
    } else alert((d as { error?: string }).error || '更新失敗');
    setToggleSavingIds((m) => ({ ...m, [item.gameModuleId]: false }));
  };

  const handleLoginLock = async () => {
    if (!classId) return;
    const newVal = !status?.classGroup?.loginLocked;
    if (newVal) { setLockModalOpen(true); return; }
    const res = await fetch(`/api/class-groups/${classId}/login-lock`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginLocked: false }) });
    if (res.ok) mutate();
  };

  const confirmLock = async () => {
    if (!classId) return;
    if (!lockPassword) { alert('請輸入老師密碼'); return; }
    setLockSaving(true);
    const res = await fetch(`/api/class-groups/${classId}/login-lock`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginLocked: true, password: lockPassword }) });
    const data = await res.json();
    setLockSaving(false);
    if (!res.ok) { alert(data.error || '鎖定失敗'); return; }
    setLockPassword('');
    setLockModalOpen(false);
    mutate();
  };

  const handleAddOne = async () => {
    if (!newAccount.trim() || !newPassword) { alert('請填寫帳號與密碼'); return; }
    const res = await fetch(`/api/class-groups/${classId}/students`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: newAccount.trim(), password: newPassword }) });
    if (res.ok) { mutateStudents(); setNewAccount(''); setNewPassword(''); setAddModalOpen(false); }
    else { const d = await res.json(); alert(d.error || '新增失敗'); }
  };

  const loadNextStudent = async () => {
    if (!classId) return;
    setNextLoading(true);
    const res = await fetch(`/api/class-groups/${classId}/students/next`);
    const data = await res.json();
    setNextLoading(false);
    if (!res.ok) { alert(data.error || '取得下一號失敗'); return; }
    setNewAccount(data.account);
    setNewPassword(data.password);
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('確定移出本班？')) return;
    const res = await fetch(`/api/class-groups/${classId}/students/${userId}`, { method: 'DELETE' });
    if (res.ok) mutateStudents();
  };

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-600">驗證身分中...</p></div>;
  }

  const hasError = error || data?.error;
  const students = studentsData?.students ?? [];

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
                  <p className="text-xs text-gray-500">{teacherClasses.find((c) => c.id === classId)?.name ?? '—'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    router.push('/dashboard/teacher/announcements');
                  }}
                  className="w-full px-4 py-2 text-left text-sm font-medium text-sky-800 hover:bg-sky-50"
                >
                  📢 班級公告
                </button>
                <button type="button" onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">登出</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden lg:items-stretch">
        <div className="mx-auto grid w-full max-w-7xl min-h-0 flex-1 gap-6 lg:grid-cols-3 lg:items-stretch">
          {/* 左：班級與設定 */}
          <div className="rounded-2xl border border-gray-200/60 bg-white/90 p-6 shadow-lg backdrop-blur-sm min-h-0">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700"><User className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">老師</p><p className="font-semibold text-gray-900">{user.name}</p><p className="text-xs text-gray-400">{user.account}</p></div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-500">班級</p>
                  <p className="font-semibold text-gray-900">{status?.classGroup?.name ?? teacherClasses[0]?.name ?? '—'}</p>
                </div>
              </div>
            </div>
            {classId && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-sm text-gray-500">非上課時間禁止登入（鎖定需輸入老師密碼）</p>
                <button type="button" onClick={handleLoginLock} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${status?.classGroup?.loginLocked ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                  {status?.classGroup?.loginLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  {status?.classGroup?.loginLocked ? '已鎖定' : '未鎖定'}
                </button>
              </div>
            )}
            {lockModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => (!lockSaving ? setLockModalOpen(false) : undefined)}>
                <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">確認鎖定登入</h3>
                  <p className="mb-4 text-sm text-gray-500">鎖定後：學生端會在下一次狀態輪詢時自動被登出，並且無法再次登入。</p>
                  <label className="mb-1 block text-sm text-gray-600">老師密碼</label>
                  <input type="password" value={lockPassword} onChange={(e) => setLockPassword(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="請輸入老師密碼" />
                  <div className="mt-6 flex gap-2">
                    <button type="button" disabled={lockSaving} onClick={() => setLockModalOpen(false)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">取消</button>
                    <button type="button" disabled={lockSaving} onClick={confirmLock} className="flex-1 rounded-lg bg-red-600 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50">{lockSaving ? '鎖定中...' : '確認鎖定'}</button>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <button type="button" onClick={() => window.open(classId ? `/dashboard/teacher/preview?classGroupId=${classId}` : '/dashboard/teacher/preview', '_blank')} className="flex w-full items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200">
                <Eye className="h-4 w-4" /> 學生視角預覽
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200/60 bg-white/90 p-6 shadow-lg backdrop-blur-sm lg:col-span-2 lg:min-h-0">
            <div className="mb-4 flex shrink-0 flex-wrap gap-2">
              {(['control', 'students', 'logs'] as Tab[]).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={`flex items-center gap-1 rounded-lg px-4 py-2 text-sm ${tab === t ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {t === 'control' && <Gamepad2 className="h-4 w-4" />}
                  {t === 'students' && <Users className="h-4 w-4" />}
                  {t === 'logs' && <ClipboardList className="h-4 w-4" />}
                  {t === 'control' && '課程任務中控台'}
                  {t === 'students' && '班級成員管理'}
                  {t === 'logs' && '學生答題與歷程追蹤'}
                </button>
              ))}
            </div>

            {tab === 'control' && (
              <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/40 via-white to-white p-4 shadow-inner sm:p-5">
                <div className="flex min-h-0 min-h-[280px] flex-1 flex-col gap-4 lg:min-h-0 lg:flex-row lg:gap-5">
                  {/* 左（桌機）：說明、表單捷徑、分類；手機：整欄在上 */}
                  <div className="flex min-h-0 shrink-0 flex-col gap-4 lg:w-[min(100%,340px)] lg:max-w-[40%] lg:shrink-0 lg:overflow-y-auto lg:pr-1">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-gray-900">課程任務中控台</h2>
                      <p className="mt-1 text-sm leading-relaxed text-gray-600">
                        左側選<strong className="font-semibold text-gray-800">活動分類</strong>，右側用「開放／關閉」控制學生是否看得到該活動。不同分類可同時開放。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => router.push('/dashboard/forms')}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50"
                      >
                        管理表單活動
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push('/dashboard/forms/new')}
                        className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-50"
                      >
                        新增表單活動
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            classId
                              ? `/dashboard/competitions?classGroupId=${encodeURIComponent(classId)}`
                              : '/dashboard/competitions'
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-900 hover:bg-violet-100"
                      >
                        <Trophy className="h-4 w-4 shrink-0" />
                        班級競賽
                      </button>
                    </div>

                    {openSummary?.openActivities && openSummary.openActivities.length > 0 && (
                      <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">學生端目前可進入</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {openSummary.openActivities.map((a) => (
                            <span
                              key={a.gameModuleId}
                              className="inline-flex max-w-full items-center rounded-full border border-emerald-300/80 bg-white px-3 py-1 text-sm font-medium break-words text-emerald-900 shadow-sm"
                            >
                              {(a.gameName && String(a.gameName).trim()) || a.gameCode || '未命名活動'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{data?.error ?? '無法載入'}</div>
                    )}
                    {isLoading && !status && <p className="text-gray-500">載入中...</p>}

                    <div className="rounded-2xl border border-amber-200/90 bg-white/90 p-4 shadow-sm md:p-5">
                      <p className="mb-2 text-sm font-extrabold tracking-wide text-gray-800">活動分類</p>
                      <p className="mb-3 text-xs leading-relaxed text-gray-500 md:text-sm">點選後，右側會列出該分類內活動。</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        {(status?.sessions ?? []).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSessionId(s.id)}
                            className={`inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 px-4 py-3 text-center text-base font-bold leading-snug whitespace-normal break-words transition sm:min-h-[52px] sm:w-auto sm:min-w-[7.5rem] sm:flex-1 sm:basis-[calc(50%-0.25rem)] md:text-lg ${
                              effectiveSessionId === s.id
                                ? 'border-amber-500 bg-amber-500 text-white shadow-md'
                                : 'border-gray-200 bg-white text-gray-900 hover:border-amber-300 hover:bg-amber-50/50'
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 右（桌機）：活動列表專用欄，獨立捲動 */}
                  <div className="flex min-h-0 min-h-[220px] flex-1 flex-col rounded-xl border border-amber-200/60 bg-white/50 p-3 lg:min-h-0">
                    <p className="mb-1 shrink-0 text-xs font-bold uppercase tracking-widest text-gray-500 md:text-sm">
                      此分類活動 · {status?.session?.name ?? '—'}
                    </p>
                    <p className="mb-2 shrink-0 text-xs text-gray-500 md:text-sm">此區可獨立捲動；活動多時請往下滑</p>
                    <div
                      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-xl border border-amber-200/70 bg-white/80 p-3 pr-2 shadow-inner [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-amber-100/90 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-400/90 hover:[&::-webkit-scrollbar-thumb]:bg-amber-500 lg:min-h-[12rem]"
                      style={{ scrollbarWidth: 'thin', scrollbarColor: '#f59e0b #fef3c7' }}
                    >
                      <div className="space-y-3">
                    {effectiveSessionId && status?.unlocks && status.unlocks.length > 0 ? (
                      status.unlocks.map((item) => {
                        const saving = !!toggleSavingIds[item.gameModuleId];
                        const activityTitle =
                          (item.gameName && String(item.gameName).trim()) || item.gameCode || '未命名活動';
                        return (
                          <div
                            key={item.gameModuleId}
                            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                          >
                            {/* 上：標題（可換行，不用 truncate，避免捲動區內寬度異常時看不到字） */}
                            <div className="min-w-0">
                              <p className="text-base font-semibold leading-snug break-words text-gray-900">
                                {activityTitle}
                              </p>
                              <p className="mt-1 break-all font-mono text-xs text-gray-500" title={item.gameCode}>
                                {item.gameCode}
                              </p>
                            </div>
                            {/* 下：按鈕列 — 手機：示範整列 + 開放/關閉並排；md+：橫排；列本身可橫向捲動，避免被外層裁切 */}
                            <div className="mt-4 min-w-0">
                              <div className="flex flex-col gap-2 md:flex-row md:flex-nowrap md:items-stretch md:justify-start md:gap-3 md:overflow-x-auto md:overflow-y-visible md:pb-1 md:[-webkit-overflow-scrolling:touch]">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/dashboard/teacher/play/${encodeURIComponent(item.gameCode)}?classGroupId=${encodeURIComponent(status.classGroup.id)}&sessionId=${encodeURIComponent(effectiveSessionId)}`
                                  )
                                }
                                className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-amber-400 bg-amber-50 px-4 text-sm font-bold text-amber-900 shadow-sm transition hover:bg-amber-100 md:h-11 md:w-auto md:min-w-[8.5rem]"
                              >
                                <MonitorPlay className="h-4 w-4 shrink-0" />
                                進入示範
                              </button>
                              <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0 md:gap-2">
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => handleSetUnlock(item, status.classGroup.id, true)}
                                  className={`inline-flex h-12 min-h-[44px] items-center justify-center rounded-xl border-2 px-3 text-sm font-bold transition md:h-11 md:min-w-[6.5rem] ${
                                    item.isUnlocked
                                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-md'
                                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-emerald-400 hover:bg-emerald-50'
                                  } disabled:opacity-50`}
                                >
                                  {saving && item.isUnlocked ? '…' : '開放'}
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => handleSetUnlock(item, status.classGroup.id, false)}
                                  className={`inline-flex h-12 min-h-[44px] items-center justify-center rounded-xl border-2 px-3 text-sm font-bold transition md:h-11 md:min-w-[6.5rem] ${
                                    !item.isUnlocked
                                      ? 'border-gray-700 bg-gray-800 text-white shadow-md'
                                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-400 hover:bg-gray-100'
                                  } disabled:opacity-50`}
                                >
                                  {saving && !item.isUnlocked ? '…' : '關閉'}
                                </button>
                              </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : effectiveSessionId && !isLoading ? (
                      <p className="py-8 text-center text-sm text-gray-500">此分類尚無活動</p>
                    ) : null}
                    </div>
                  </div>
                </div>
                </div>
              </div>
            )}

            {tab === 'students' && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <h2 className="mb-4 shrink-0 text-lg font-bold text-gray-900">班級成員管理</h2>
                <p className="mb-3 shrink-0 text-sm text-gray-500">可搜尋、排序、依性別/年級篩選。清單固定高度，超出以內部捲動顯示。</p>

                <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                  <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1.5">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="搜尋帳號（如 ST-01）" className="w-44 bg-transparent text-sm outline-none" />
                  </div>
                  <button type="button" onClick={() => setStudentSort((v) => (v === 'account_asc' ? 'account_desc' : 'account_asc'))} className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <ArrowUpDown className="h-4 w-4" /> 帳號排序
                  </button>
                  <div className="ml-auto text-sm text-gray-600">本班學員：{students.length}</div>
                </div>

                <div className="mb-4 grid shrink-0 gap-2 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">性別</span>
                    {(['男生', '女生'] as const).map((g) => (
                      <label key={g} className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={filterGender[g]} onChange={(e) => setFilterGender((m) => ({ ...m, [g]: e.target.checked }))} />
                        {g}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">年級</span>
                    {(['三年級', '四年級', '五年級', '六年級'] as const).map((g) => (
                      <label key={g} className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={filterGrade[g]} onChange={(e) => setFilterGrade((m) => ({ ...m, [g]: e.target.checked }))} />
                        {g}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mb-4 shrink-0">
                  <button type="button" onClick={() => { setAddModalOpen(true); loadNextStudent(); }} className="rounded-lg bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600">新增成員</button>
                </div>
                {addModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAddModalOpen(false)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                      <h3 className="mb-4 text-lg font-semibold">新增學員</h3>
                      <p className="mb-3 text-sm text-gray-500">系統自動產生下一個流水號帳密，確認後建立。</p>
                      <div className="space-y-3">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs text-gray-500">帳號</div>
                              <div className="text-lg font-bold text-gray-900">{newAccount || '—'}</div>
                            </div>
                            <button type="button" disabled={nextLoading} onClick={loadNextStudent} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                              {nextLoading ? '產生中...' : '重新產生下一號'}
                            </button>
                          </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className="text-xs text-gray-500">預設密碼</div>
                          <div className="text-lg font-bold text-gray-900">{newPassword || '—'}</div>
                        </div>
                      </div>
                      <div className="mt-6 flex gap-2">
                        <button type="button" onClick={() => setAddModalOpen(false)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50">取消</button>
                        <button type="button" disabled={!newAccount || !newPassword} onClick={handleAddOne} className="flex-1 rounded-lg bg-amber-500 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-50">確認新增</button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-inner">
                  <div
                    className="h-full max-h-[min(420px,calc(100vh-22rem))] min-h-[200px] overflow-y-auto overscroll-y-contain scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable] [touch-action:pan-y] lg:max-h-[min(52vh,520px)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f9fafb' }}
                  >
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgb(229_231_235)]">
                        <tr className="border-b text-left">
                          <th className="p-3">帳號</th>
                          <th className="p-3">性別</th>
                          <th className="p-3">年級</th>
                          <th className="p-3">已填資料</th>
                          <th className="p-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students
                          .filter((s) => (studentSearch ? s.account.toLowerCase().includes(studentSearch.trim().toLowerCase()) : true))
                          .filter((s) => {
                            const anyGender = filterGender.男生 || filterGender.女生;
                            const anyGrade = filterGrade.三年級 || filterGrade.四年級 || filterGrade.五年級 || filterGrade.六年級;
                            const okGender = !anyGender || (!!s.gender && (s.gender === '男生' ? filterGender.男生 : filterGender.女生));
                            const okGrade = !anyGrade || (!!s.grade && (filterGrade as Record<string, boolean>)[s.grade] === true);
                            return okGender && okGrade;
                          })
                          .sort((a, b) => (studentSort === 'account_asc' ? a.account.localeCompare(b.account) : b.account.localeCompare(a.account)))
                          .map((s) => (
                            <tr key={s.id} className="border-b last:border-b-0 hover:bg-gray-50">
                              <td className="p-3 font-medium text-gray-900">{s.account}</td>
                              <td className="p-3">{s.gender ?? '—'}</td>
                              <td className="p-3">{s.grade ?? '—'}</td>
                              <td className="p-3">{s.onboardingDone ? '是' : '否'}</td>
                              <td className="p-3 text-right">
                                <button type="button" onClick={() => handleRemove(s.id)} className="text-xs text-red-600 hover:underline">移出</button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === 'logs' && (
              <>
                <h2 className="mb-2 text-lg font-bold text-gray-900">學生答題與歷程追蹤</h2>
                <p className="mb-4 text-sm text-gray-500">時間含毫秒。搜尋可對應任一欄位（時間、帳號、動作、遊戲、內容）。</p>

                <div className="mb-4 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setLogScope('all')}
                      className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                        logScope === 'all' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      全班
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLogScope('single');
                        if (!logStudentId && studentsSorted[0]) setLogStudentId(studentsSorted[0].id);
                      }}
                      className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                        logScope === 'single' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      單一學員
                    </button>
                  </div>
                  {logScope === 'single' && studentsSorted.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
                      {studentsSorted.map((s) => {
                        const active = (logStudentId || studentsSorted[0]?.id) === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setLogStudentId(s.id)}
                            className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                              active ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 bg-gray-50 text-gray-800 hover:border-amber-300'
                            }`}
                          >
                            {s.account}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {logScope === 'single' && studentsSorted.length === 0 && (
                    <p className="text-sm text-gray-500">尚無學員可選</p>
                  )}
                  <div className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-gray-50/80 px-4 py-3 focus-within:border-amber-400">
                    <Search className="h-5 w-5 shrink-0 text-gray-400" />
                    <input
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="搜尋…（帳號、動作、遊戲代碼、內容等）"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                    />
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="max-h-[420px] overflow-y-auto scroll-smooth overscroll-y-contain [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr className="border-b text-left">
                          <th className="p-3">時間(含毫秒)</th>
                          <th className="p-3">學員</th>
                          <th className="p-3">Action</th>
                          <th className="p-3">遊戲</th>
                          <th className="p-3">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(logsData?.logs ?? [])
                          .filter((l) => {
                            const t = logSearch.trim().toLowerCase();
                            if (!t) return true;
                            const timeStr = fmtLogTime(l.createdAt).toLowerCase();
                            const detailStr =
                              typeof l.detail === 'object' && l.detail !== null ? JSON.stringify(l.detail) : String(l.detail ?? '');
                            const hay = [timeStr, l.actionType, l.user?.account, l.gameModule?.code, l.gameModule?.name, detailStr]
                              .join(' ')
                              .toLowerCase();
                            return hay.includes(t);
                          })
                          .map((log) => (
                            <tr key={log.id} className="border-b last:border-b-0 hover:bg-gray-50">
                              <td className="p-3 text-gray-700 whitespace-nowrap">{fmtLogTime(log.createdAt)}</td>
                              <td className="p-3">{log.user?.account ?? '—'}</td>
                              <td className="p-3 font-medium">{log.actionType}</td>
                              <td className="p-3">{log.gameModule?.code ?? '—'}</td>
                              <td className="p-3 max-w-xs truncate" title={typeof log.detail === 'object' ? JSON.stringify(log.detail) : String(log.detail)}>{typeof log.detail === 'object' ? JSON.stringify(log.detail) : String(log.detail ?? '')}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
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
