'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  CirclePlus,
  Copy,
  FileQuestion,
  GripVertical,
  ListChecks,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT' | 'NUMBER';

interface TermItem {
  id: string;
  name: string;
}

export interface BuilderOption {
  id?: string;
  localId: string;
  label: string;
  value: string;
}

export interface BuilderQuestion {
  id?: string;
  localId: string;
  title: string;
  description: string;
  type: QuestionType;
  isRequired: boolean;
  placeholder: string;
  minValue: string;
  maxValue: string;
  options: BuilderOption[];
}

export interface FormBuilderInitialData {
  termId: string;
  title: string;
  description: string;
  allowMultipleSubmissions: boolean;
  allowEditAfterSubmit: boolean;
  allowViewAfterSubmit: boolean;
  questions: BuilderQuestion[];
}

interface LocalDraftPayload {
  termId: string;
  title: string;
  description: string;
  allowMultipleSubmissions: boolean;
  allowEditAfterSubmit: boolean;
  allowViewAfterSubmit: boolean;
  questions: BuilderQuestion[];
  savedAt: string;
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createOption(seed = ''): BuilderOption {
  return {
    localId: uid(),
    label: seed,
    value: seed,
  };
}

export function createQuestion(type: QuestionType = 'SINGLE_CHOICE'): BuilderQuestion {
  return {
    localId: uid(),
    title: '',
    description: '',
    type,
    isRequired: false,
    placeholder: '',
    minValue: '',
    maxValue: '',
    options:
      type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE'
        ? [createOption('選項 1'), createOption('選項 2')]
        : [],
  };
}

function normalizeInitial(initialData?: FormBuilderInitialData): FormBuilderInitialData {
  if (initialData) return initialData;
  return {
    termId: '',
    title: '',
    description: '',
    allowMultipleSubmissions: false,
    allowEditAfterSubmit: false,
    allowViewAfterSubmit: true,
    questions: [createQuestion('SINGLE_CHOICE')],
  };
}

export default function FormBuilder({
  submitUrl,
  submitMethod,
  initialData,
  pageTitle,
  pageDescription,
  saveLabel,
  successMessage,
  returnPath,
  readonly = false,
}: {
  submitUrl: string;
  submitMethod: 'POST' | 'PATCH';
  initialData?: FormBuilderInitialData;
  pageTitle: string;
  pageDescription: string;
  saveLabel: string;
  successMessage: string;
  returnPath: string;
  readonly?: boolean;
}) {
  const router = useRouter();
  const { data: meData, isLoading: authLoading } = useSWR<{ user?: { role: string; account: string } }>(
    '/api/auth/me',
    fetcher
  );
  const { data: termsData } = useSWR<{ terms: TermItem[] }>('/api/activity-categories', fetcher);
  const base = normalizeInitial(initialData);
  const draftKey = `form-builder-draft:${submitMethod}:${submitUrl}`;

  const [termId, setTermId] = useState(base.termId);
  const [title, setTitle] = useState(base.title);
  const [description, setDescription] = useState(base.description);
  const [allowMultipleSubmissions, setAllowMultipleSubmissions] = useState(base.allowMultipleSubmissions);
  const [allowEditAfterSubmit, setAllowEditAfterSubmit] = useState(base.allowEditAfterSubmit);
  const [allowViewAfterSubmit, setAllowViewAfterSubmit] = useState(base.allowViewAfterSubmit);
  const [questions, setQuestions] = useState<BuilderQuestion[]>(base.questions);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<LocalDraftPayload | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const user = meData?.user;
  const roleOk = user && (user.role === 'TEACHER' || user.role === 'ADMIN');

  const payload = useMemo(
    () => ({
      termId,
      title,
      description,
      allowMultipleSubmissions,
      allowEditAfterSubmit,
      allowViewAfterSubmit,
      questions: questions.map((question) => ({
        id: question.id,
        title: question.title,
        description: question.description,
        type: question.type,
        isRequired: question.isRequired,
        placeholder: question.placeholder || null,
        minValue: question.minValue === '' ? null : Number(question.minValue),
        maxValue: question.maxValue === '' ? null : Number(question.maxValue),
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
          value: option.label || option.value,
        })),
      })),
    }),
    [
      allowEditAfterSubmit,
      allowMultipleSubmissions,
      allowViewAfterSubmit,
      description,
      questions,
      termId,
      title,
    ]
  );

  const blocked = !authLoading && !roleOk;

  const terms = termsData?.terms ?? [];
  const completedQuestions = questions.filter((question) => question.title.trim()).length;
  const draftSavedText = useMemo(() => {
    if (!lastDraftSavedAt) return '尚未暫存';
    const d = new Date(lastDraftSavedAt);
    return `已暫存於 ${d.toLocaleTimeString('zh-TW', { hour12: false })}`;
  }, [lastDraftSavedAt]);

  const applyDraft = (draft: LocalDraftPayload) => {
    setTermId(draft.termId ?? '');
    setTitle(draft.title ?? '');
    setDescription(draft.description ?? '');
    setAllowMultipleSubmissions(Boolean(draft.allowMultipleSubmissions));
    setAllowEditAfterSubmit(Boolean(draft.allowEditAfterSubmit));
    setAllowViewAfterSubmit(
      draft.allowViewAfterSubmit === undefined ? true : Boolean(draft.allowViewAfterSubmit)
    );
    setQuestions(
      Array.isArray(draft.questions) && draft.questions.length > 0
        ? draft.questions.map((question) => ({
            ...question,
            localId: question.localId || uid(),
            options: (question.options ?? []).map((option) => ({
              ...option,
              localId: option.localId || uid(),
            })),
          }))
        : [createQuestion('SINGLE_CHOICE')]
    );
    setLastDraftSavedAt(draft.savedAt || new Date().toISOString());
    setHasPendingChanges(false);
  };

  const persistLocalDraft = useCallback(
    (override?: LocalDraftPayload) => {
      if (readonly || typeof window === 'undefined') return;
      const nowIso = new Date().toISOString();
      const draft: LocalDraftPayload = override ?? {
        termId,
        title,
        description,
        allowMultipleSubmissions,
        allowEditAfterSubmit,
        allowViewAfterSubmit,
        questions,
        savedAt: nowIso,
      };
      if (!override) draft.savedAt = nowIso;
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setLastDraftSavedAt(draft.savedAt);
      setHasPendingChanges(false);
    },
    [
      allowEditAfterSubmit,
      allowMultipleSubmissions,
      allowViewAfterSubmit,
      description,
      draftKey,
      questions,
      readonly,
      termId,
      title,
    ]
  );

  useEffect(() => {
    if (!blocked) return;
    router.replace('/dashboard');
  }, [blocked, router]);

  useEffect(() => {
    if (readonly || typeof window === 'undefined') return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as LocalDraftPayload;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.questions)) return;
      const hasContent =
        Boolean(parsed.title?.trim()) ||
        Boolean(parsed.description?.trim()) ||
        parsed.questions.some((q) => q.title?.trim());
      if (!hasContent) return;
      window.setTimeout(() => setPendingDraft(parsed), 0);
    } catch {
      // Ignore invalid local draft payload.
    }
  }, [draftKey, readonly]);

  useEffect(() => {
    if (readonly || typeof window === 'undefined') return;
    const markDirtyTimer = window.setTimeout(() => {
      setHasPendingChanges(true);
    }, 0);
    const timer = window.setTimeout(() => {
      persistLocalDraft();
    }, 1200);
    return () => {
      window.clearTimeout(markDirtyTimer);
      window.clearTimeout(timer);
    };
  }, [
    allowEditAfterSubmit,
    allowMultipleSubmissions,
    allowViewAfterSubmit,
    description,
    draftKey,
    persistLocalDraft,
    questions,
    readonly,
    termId,
    title,
  ]);

  useEffect(() => {
    if (readonly || typeof window === 'undefined') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasPendingChanges, readonly]);

  const updateQuestion = (localId: string, patch: Partial<BuilderQuestion>) => {
    setQuestions((prev) =>
      prev.map((question) => (question.localId === localId ? { ...question, ...patch } : question))
    );
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const save = async () => {
    if (readonly) return;
    setSaving(true);
    setMessage('');
    setMessageType('success');
    const res = await fetch(submitUrl, {
      method: submitMethod,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessageType('error');
      setMessage(data.error || '儲存失敗');
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(draftKey);
    }
    setPendingDraft(null);
    setHasPendingChanges(false);
    setLastDraftSavedAt(null);
    setMessageType('success');
    setMessage(successMessage);
    alert(successMessage);
    router.push(returnPath);
  };

  if (blocked) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold text-amber-700">NovaInsight 資訊科普教育平台</p>
              <h1 className="mt-2 text-3xl font-black text-gray-900">{pageTitle}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{pageDescription}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push('/dashboard/forms')}
                className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700"
              >
                表單列表
              </button>
              <button
                type="button"
                onClick={() => router.push(returnPath)}
                className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700"
              >
                返回
              </button>
            </div>
          </div>
          {!readonly && pendingDraft && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">
                發現上次未完成草稿（{new Date(pendingDraft.savedAt).toLocaleString('zh-TW')}）
              </p>
              <p className="mt-1">可直接還原上次內容，避免重新輸入。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    applyDraft(pendingDraft);
                    setPendingDraft(null);
                  }}
                  className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white"
                >
                  還原草稿
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') localStorage.removeItem(draftKey);
                    setPendingDraft(null);
                    setLastDraftSavedAt(null);
                  }}
                  className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-900"
                >
                  不使用草稿
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-xl">
              <div className="flex items-center gap-2 text-gray-900">
                <Settings2 className="h-5 w-5 text-amber-600" />
                <h2 className="text-xl font-black">基本設定</h2>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-700">活動分類</label>
                  <select
                    value={termId}
                    onChange={(e) => setTermId(e.target.value)}
                    disabled={readonly}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm disabled:bg-gray-50"
                  >
                    <option value="">請選擇分類</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700">表單名稱</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={readonly}
                    placeholder="例如：3/21 課後回饋表"
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700">表單說明</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={readonly}
                    rows={5}
                    placeholder="可填寫作答說明、提醒、用途"
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm disabled:bg-gray-50"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-xl">
              <div className="flex items-center gap-2 text-gray-900">
                <ListChecks className="h-5 w-5 text-amber-600" />
                <h2 className="text-xl font-black">作答規則</h2>
              </div>
              <div className="mt-5 space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={allowMultipleSubmissions}
                    onChange={(e) => setAllowMultipleSubmissions(e.target.checked)}
                    disabled={readonly}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm leading-6 text-gray-700">允許學生重複送出多次</span>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={allowEditAfterSubmit}
                    onChange={(e) => setAllowEditAfterSubmit(e.target.checked)}
                    disabled={readonly}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm leading-6 text-gray-700">送出後仍可修改答案</span>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={allowViewAfterSubmit}
                    onChange={(e) => setAllowViewAfterSubmit(e.target.checked)}
                    disabled={readonly}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm leading-6 text-gray-700">學生送出後可查看自己填過的內容</span>
                </label>
              </div>

              <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800">編輯進度</p>
                <div className="mt-2 text-2xl font-black text-gray-900">
                  {completedQuestions} / {questions.length}
                </div>
                <p className="mt-1 text-sm text-gray-600">已有題目標題的題數</p>
                {!readonly && <p className="mt-2 text-xs text-amber-800">{draftSavedText}</p>}
              </div>

              {message && (
                <p
                  className={`mt-4 text-sm font-medium ${
                    messageType === 'error' ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {message}
                </p>
              )}

              {!readonly && (
                <div className="mt-5 space-y-2">
                  <button
                    type="button"
                    onClick={() => persistLocalDraft()}
                    className="w-full rounded-2xl border border-amber-200 bg-white px-5 py-3 text-sm font-bold text-amber-900"
                  >
                    暫存到本機
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="w-full rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-200 disabled:opacity-60"
                  >
                    {saving ? '儲存中...' : saveLabel}
                  </button>
                </div>
              )}
            </section>
          </aside>

          <section className="space-y-4">
            <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-gray-900">
                  <FileQuestion className="h-5 w-5 text-amber-600" />
                  <h2 className="text-xl font-black">題目編輯器</h2>
                </div>
                {!readonly && (
                  <div className="ml-auto flex flex-wrap gap-2">
                    {(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT', 'NUMBER'] as QuestionType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setQuestions((prev) => [...prev, createQuestion(type)])}
                        className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800"
                      >
                        <Plus className="mr-1 inline h-4 w-4" />
                        新增{type === 'SINGLE_CHOICE' ? '單選' : type === 'MULTIPLE_CHOICE' ? '多選' : type === 'TEXT' ? '文字' : '數字'}題
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {questions.map((question, index) => (
              <article
                key={question.localId}
                className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-xl"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">
                    <GripVertical className="h-4 w-4" />
                    第 {index + 1} 題
                  </div>
                  <select
                    value={question.type}
                    onChange={(e) => {
                      const nextType = e.target.value as QuestionType;
                      updateQuestion(question.localId, {
                        type: nextType,
                        options:
                          nextType === 'SINGLE_CHOICE' || nextType === 'MULTIPLE_CHOICE'
                            ? question.options.length > 0
                              ? question.options
                              : [createOption('選項 1'), createOption('選項 2')]
                            : [],
                      });
                    }}
                    disabled={readonly}
                    className="rounded-2xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                  >
                    <option value="SINGLE_CHOICE">單選題</option>
                    <option value="MULTIPLE_CHOICE">多選題</option>
                    <option value="TEXT">文字題</option>
                    <option value="NUMBER">數字題</option>
                  </select>
                  <label className="ml-auto flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={question.isRequired}
                      onChange={(e) => updateQuestion(question.localId, { isRequired: e.target.checked })}
                      disabled={readonly}
                    />
                    必填
                  </label>
                  {!readonly && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const cloned: BuilderQuestion = {
                            ...createQuestion(question.type),
                            title: '',
                            description: '',
                            isRequired: false,
                            placeholder: '',
                            minValue: '',
                            maxValue: '',
                            options:
                              question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE'
                                ? [createOption('選項 1'), createOption('選項 2')]
                                : [],
                          };
                          setQuestions((prev) => {
                            const currentIndex = prev.findIndex((item) => item.localId === question.localId);
                            if (currentIndex < 0) return [...prev, cloned];
                            const next = [...prev];
                            next.splice(currentIndex + 1, 0, cloned);
                            return next;
                          });
                        }}
                        className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-700"
                      >
                        同類新題
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const cloned: BuilderQuestion = {
                            ...question,
                            id: undefined,
                            localId: uid(),
                            options: question.options.map((option) => ({
                              ...option,
                              id: undefined,
                              localId: uid(),
                            })),
                          };
                          setQuestions((prev) => {
                            const currentIndex = prev.findIndex((item) => item.localId === question.localId);
                            if (currentIndex < 0) return [...prev, cloned];
                            const next = [...prev];
                            next.splice(currentIndex + 1, 0, cloned);
                            return next;
                          });
                        }}
                        className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700"
                      >
                        <Copy className="mr-1 inline h-4 w-4" />
                        複製
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, -1)}
                        disabled={index === 0}
                        className="rounded-2xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-40"
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, 1)}
                        disabled={index === questions.length - 1}
                        className="rounded-2xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-40"
                      >
                        下移
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQuestions((prev) => prev.filter((item) => item.localId !== question.localId))
                        }
                        disabled={questions.length === 1}
                        className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600 disabled:opacity-40"
                      >
                        <Trash2 className="mr-1 inline h-4 w-4" />
                        刪除
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700">題目文字</label>
                    <input
                      value={question.title}
                      onChange={(e) => updateQuestion(question.localId, { title: e.target.value })}
                      disabled={readonly}
                      className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700">補充說明</label>
                    <textarea
                      value={question.description}
                      onChange={(e) => updateQuestion(question.localId, { description: e.target.value })}
                      disabled={readonly}
                      rows={3}
                      className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm disabled:bg-gray-50"
                    />
                  </div>
                  {(question.type === 'TEXT' || question.type === 'NUMBER') && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className={question.type === 'TEXT' ? 'md:col-span-3' : ''}>
                        <label className="text-sm font-bold text-gray-700">提示文字</label>
                        <input
                          value={question.placeholder}
                          onChange={(e) => updateQuestion(question.localId, { placeholder: e.target.value })}
                          disabled={readonly}
                          className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm disabled:bg-gray-50"
                        />
                      </div>
                      {question.type === 'NUMBER' && (
                        <>
                          <div>
                            <label className="text-sm font-bold text-gray-700">最小值</label>
                            <input
                              type="number"
                              value={question.minValue}
                              onChange={(e) => updateQuestion(question.localId, { minValue: e.target.value })}
                              disabled={readonly}
                              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm disabled:bg-gray-50"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-bold text-gray-700">最大值</label>
                            <input
                              type="number"
                              value={question.maxValue}
                              onChange={(e) => updateQuestion(question.localId, { maxValue: e.target.value })}
                              disabled={readonly}
                              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm disabled:bg-gray-50"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {(question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') && (
                    <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-800">選項</p>
                        {!readonly && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuestion(question.localId, {
                                  options: [...question.options, createOption(`選項 ${question.options.length + 1}`)],
                                })
                              }
                              className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-700"
                            >
                              <CirclePlus className="mr-1 inline h-4 w-4" />
                              新增選項
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const raw = window.prompt('每行輸入一個選項，會覆蓋目前選項');
                                if (raw === null) return;
                                const rows = raw
                                  .split('\n')
                                  .map((line) => line.trim())
                                  .filter(Boolean);
                                if (rows.length < 2) {
                                  setMessageType('error');
                                  setMessage('批次貼上至少需要 2 個選項');
                                  return;
                                }
                                updateQuestion(question.localId, {
                                  options: rows.map((label) => createOption(label)),
                                });
                                setMessageType('success');
                                setMessage(`已貼上 ${rows.length} 個選項`);
                              }}
                              className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-700"
                            >
                              批次貼上
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        {question.options.map((option) => (
                          <div key={option.localId} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                            <input
                              value={option.label}
                              onChange={(e) =>
                                updateQuestion(question.localId, {
                                  options: question.options.map((item) =>
                                    item.localId === option.localId
                                      ? { ...item, label: e.target.value, value: e.target.value }
                                      : item
                                  ),
                                })
                              }
                              disabled={readonly}
                              placeholder="選項文字"
                              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm disabled:bg-gray-50"
                            />
                            {!readonly && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuestion(question.localId, {
                                    options: question.options.filter((item) => item.localId !== option.localId),
                                  })
                                }
                                disabled={question.options.length <= 2}
                                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 disabled:opacity-40"
                              >
                                刪除
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
