'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  List,
  Save,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT' | 'NUMBER';
type AccessState =
  | 'editable'
  | 'submitted_locked_hidden'
  | 'submitted_locked_visible'
  | 'submitted_editable';

interface FormQuestionOption {
  id: string;
  orderIndex: number;
  label: string;
  value: string;
}

interface FormQuestion {
  id: string;
  orderIndex: number;
  title: string;
  description: string | null;
  type: QuestionType;
  isRequired: boolean;
  placeholder: string | null;
  minValue: number | null;
  maxValue: number | null;
  options: FormQuestionOption[];
}

interface FormPayload {
  id: string;
  title: string;
  description: string | null;
  settings: {
    allowMultipleSubmissions: boolean;
    allowEditAfterSubmit: boolean;
    allowViewAfterSubmit: boolean;
  };
  gameModule: {
    id: string;
    code: string;
    name: string;
  };
  term: {
    id: string;
    name: string;
  };
  questions: FormQuestion[];
}

interface SubmissionPayload {
  id: string;
  status: 'DRAFT' | 'SUBMITTED';
  attemptNumber: number;
  submittedAt: string | null;
  answers: Record<string, unknown>;
}

interface FormResponse {
  form: FormPayload;
  submission: SubmissionPayload | null;
  accessState: AccessState;
}

function answerFilled(question: FormQuestion, value: unknown) {
  if (question.type === 'MULTIPLE_CHOICE') return Array.isArray(value) && value.length > 0;
  if (question.type === 'NUMBER') return value !== '' && value !== null && value !== undefined;
  return String(value ?? '').trim() !== '';
}

function QuestionInput({
  question,
  value,
  disabled,
  onChange,
}: {
  question: FormQuestion;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const choiceLabelClass = (checked: boolean, extra = '') =>
    `flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 transition max-lg:gap-2 max-lg:py-2 max-lg:text-sm lg:gap-3 lg:rounded-2xl lg:px-4 lg:py-3 lg:text-base ${
      checked ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'
    } ${extra}`;

  if (question.type === 'TEXT') {
    return (
      <textarea
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={5}
        placeholder={question.placeholder ?? '請輸入你的答案'}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-gray-50 max-lg:min-h-[5rem] max-lg:text-[15px] lg:rounded-2xl lg:px-4 lg:py-3 lg:text-base"
      />
    );
  }

  if (question.type === 'NUMBER') {
    return (
      <input
        type="number"
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        disabled={disabled}
        min={question.minValue ?? undefined}
        max={question.maxValue ?? undefined}
        placeholder={question.placeholder ?? '請輸入數字'}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-gray-50 lg:rounded-2xl lg:px-4 lg:py-3 lg:text-base"
      />
    );
  }

  if (question.type === 'MULTIPLE_CHOICE') {
    const current = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2 lg:space-y-3">
        {question.options.map((option) => {
          const checked = current.includes(option.value);
          return (
            <label
              key={option.id}
              className={`${choiceLabelClass(checked, disabled ? 'cursor-not-allowed opacity-70' : 'hover:border-amber-300')}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => {
                  if (e.target.checked) onChange([...current, option.value]);
                  else onChange(current.filter((item) => item !== option.value));
                }}
                className="mt-0.5 h-4 w-4 shrink-0 lg:mt-1"
              />
              <span className="leading-snug text-gray-900">{option.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 lg:space-y-3">
      {question.options.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.id}
            className={`${choiceLabelClass(checked, disabled ? 'cursor-not-allowed opacity-70' : 'hover:border-amber-300')}`}
          >
            <input
              type="radio"
              name={question.id}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="mt-0.5 h-4 w-4 shrink-0 lg:mt-1"
            />
            <span className="leading-snug text-gray-900">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function FormActivityPlayer({
  gameCode,
  previewMode = false,
  onFinish,
  sendLog,
}: {
  gameCode: string;
  previewMode?: boolean;
  onFinish?: () => void;
  sendLog?: (action: string, payload?: Record<string, unknown>) => void | Promise<void>;
}) {
  const { data, mutate, isLoading } = useSWR<FormResponse>(
    `/api/form-activities/by-code/${encodeURIComponent(gameCode)}`,
    fetcher
  );
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  /** 送出被擋下時（例如必填未填）的紅字說明 */
  const [submitError, setSubmitError] = useState('');
  /** 手機直式：題目清單預設收合，避免佔滿螢幕、按不到下方送出 */
  const [tocOpen, setTocOpen] = useState(false);

  const form = data?.form;
  const submission = data?.submission ?? null;
  const accessState = data?.accessState ?? 'editable';
  const questions = useMemo(() => form?.questions ?? [], [form?.questions]);
  const answerValues = useMemo(
    () => ({ ...(submission?.answers ?? {}), ...answers }),
    [submission?.answers, answers]
  );
  const safeCurrentIndex = Math.min(currentIndex, Math.max(questions.length - 1, 0));
  const currentQuestion = questions[safeCurrentIndex];
  const readonly =
    previewMode ||
    accessState === 'submitted_locked_hidden' ||
    accessState === 'submitted_locked_visible';

  const completedCount = useMemo(
    () => questions.filter((question) => answerFilled(question, answerValues[question.id])).length,
    [questions, answerValues]
  );

  const saveDraft = async () => {
    if (previewMode || !form || !currentQuestion) return;
    setSaving(true);
    setMessage('');
    setSubmitError('');
    const res = await fetch(`/api/form-activities/by-code/${encodeURIComponent(gameCode)}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: answerValues, currentQuestionId: currentQuestion.id }),
    });
    const payload = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(payload.error || '暫存失敗');
      return;
    }
    setMessage('已暫存');
    await sendLog?.('FORM_SAVE', { currentQuestionId: currentQuestion.id });
    mutate();
  };

  const submit = async () => {
    if (previewMode || !form) return;
    setSubmitError('');
    setMessage('');

    const unfilled = questions.filter((q) => !answerFilled(q, answerValues[q.id]));
    const requiredUnfilled = unfilled.filter((q) => q.isRequired);

    if (requiredUnfilled.length > 0) {
      const lines = requiredUnfilled.map((q) => {
        const idx = questions.findIndex((x) => x.id === q.id) + 1;
        const raw = (q.title || '（無標題）').trim() || '（無標題）';
        const short = raw.length > 28 ? `${raw.slice(0, 28)}…` : raw;
        return `· 第 ${idx} 題：${short}`;
      });
      setSubmitError(`以下為「必填」但未完成，請先填寫後再送出：\n${lines.join('\n')}`);
      return;
    }

    if (unfilled.length > 0) {
      if (!confirm(`尚有 ${unfilled.length} 題未填寫（非必填），確定仍要送出嗎？`)) return;
    } else if (!confirm('確定送出這份表單嗎？')) {
      return;
    }

    setSubmitting(true);
    const res = await fetch(`/api/form-activities/by-code/${encodeURIComponent(gameCode)}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: answerValues }),
    });
    const payload = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setMessage(payload.error || '送出失敗');
      return;
    }
    setSubmitError('');
    setMessage('已成功送出');
    await sendLog?.('SUCCESS', { formCode: gameCode, submissionId: payload.submissionId });
    mutate();
    onFinish?.();
  };

  if (isLoading || !data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl">
        <p className="text-gray-600">表單載入中...</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
        找不到表單內容
      </div>
    );
  }

  if (accessState === 'submitted_locked_hidden') {
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center justify-center rounded-[32px] border border-emerald-200 bg-white/95 p-6 text-center shadow-xl sm:p-8">
        <CheckCircle2 className="mb-4 h-14 w-14 text-emerald-600" />
        <h2 className="text-2xl font-black text-gray-900">你已經送出過這份表單</h2>
        <p className="mt-3 text-base leading-7 text-gray-600">
          老師目前設定為送出後不可再查看或修改。
        </p>
      </div>
    );
  }

  const questionNavButtons = (afterPick?: () => void) =>
    questions.map((question, index) => {
      const active = index === safeCurrentIndex;
      const filled = answerFilled(question, answerValues[question.id]);
      return (
        <button
          key={question.id}
          type="button"
          onClick={() => {
            setCurrentIndex(index);
            afterPick?.();
            sendLog?.('FORM_VIEW_QUESTION', { questionId: question.id, index });
          }}
          className={`touch-manipulation w-full rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.99] max-lg:py-2 lg:rounded-2xl lg:px-3 lg:py-3 ${
            active
              ? 'border-amber-400 bg-amber-50'
              : 'border-gray-200 bg-white hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-gray-900 lg:text-sm">第 {index + 1} 題</span>
            {filled ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <span className="text-xs text-gray-400">未填</span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-700 lg:mt-1 lg:text-sm">{question.title}</p>
        </button>
      );
    });

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:gap-4">
      {/* 手機／直式：極窄列 + 展開題目清單（預設收合，把版面留給單題） */}
      <div className="shrink-0 lg:hidden">
        <button
          type="button"
          onClick={() => setTocOpen((v) => !v)}
          aria-expanded={tocOpen}
          className="touch-manipulation flex w-full items-center gap-2 rounded-xl border border-gray-200/90 bg-white px-2.5 py-1.5 text-left shadow-sm active:bg-amber-50/60"
        >
          <List className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold leading-tight text-amber-800">
              {form.term.name} · {form.title}
            </p>
            <p className="text-[10px] leading-tight text-gray-600">
              第 {safeCurrentIndex + 1}/{questions.length} 題 · 已完成 {completedCount} · {tocOpen ? '收合' : '展開'}
              清單
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${tocOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {tocOpen && (
          <div className="mt-1 max-h-[min(38dvh,220px)] overflow-y-auto overscroll-y-contain rounded-xl border border-amber-200/80 bg-white p-1.5 shadow-inner">
            <div className="space-y-1.5">{questionNavButtons(() => setTocOpen(false))}</div>
          </div>
        )}
      </div>

      {/* 桌機：左側題目欄 */}
      <aside className="hidden min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-xl backdrop-blur-sm lg:flex lg:w-[min(100%,280px)] lg:min-w-[220px] lg:self-stretch">
        <div className="shrink-0 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-amber-700">
            <FileText className="h-5 w-5" />
            <span className="text-sm font-bold">{form.term.name}</span>
          </div>
          <h2 className="mt-2 text-xl font-black text-gray-900">{form.title}</h2>
          {form.description && <p className="mt-2 text-sm leading-6 text-gray-600">{form.description}</p>}
        </div>

        <div className="mt-4 shrink-0 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          已完成 {completedCount} / {questions.length} 題
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
          <div className="space-y-2">{questionNavButtons()}</div>
        </div>
      </aside>

      {/* 作答區：可捲動內容 + 底部固定操作列（送出鍵永遠在區塊底部可見區） */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-md backdrop-blur-sm max-lg:rounded-xl lg:min-h-0 lg:rounded-[32px] lg:shadow-xl">
        {currentQuestion ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2.5 pb-1 pt-2 max-lg:pt-2 sm:px-4 sm:pt-4 md:px-6 md:pt-6">
              {accessState === 'submitted_locked_visible' && (
                <div className="mb-2 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800 max-lg:leading-snug lg:mb-4 lg:rounded-2xl lg:px-4 lg:py-3 lg:text-sm">
                  <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" />
                  你已送出，僅可查看。
                </div>
              )}
              {accessState === 'submitted_editable' && (
                <div className="mb-2 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-2 text-xs text-sky-800 max-lg:leading-snug lg:mb-4 lg:rounded-2xl lg:px-4 lg:py-3 lg:text-sm">
                  送出後仍可修改，改完請再送出。
                </div>
              )}

              <div className="border-b border-gray-100 pb-2 max-lg:pb-2 lg:pb-4">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 lg:gap-2 lg:text-sm">
                  <span>
                    第 {safeCurrentIndex + 1} / {questions.length} 題
                  </span>
                  {currentQuestion.isRequired && (
                    <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 lg:px-2 lg:py-1 lg:text-xs">
                      必填
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-base font-bold leading-snug text-gray-900 lg:mt-3 lg:text-2xl lg:font-black lg:leading-9">
                  {currentQuestion.title}
                </h3>
                {currentQuestion.description && (
                  <p className="mt-2 text-sm leading-snug text-gray-600 lg:mt-3 lg:text-base lg:leading-7">
                    {currentQuestion.description}
                  </p>
                )}
              </div>

              <div className="py-2 max-lg:py-2 lg:py-4">
                <QuestionInput
                  question={currentQuestion}
                  value={answerValues[currentQuestion.id]}
                  disabled={readonly}
                  onChange={(value) => {
                    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
                  }}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-200/90 bg-white/95 px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.1)] backdrop-blur-sm max-lg:py-1.5 sm:px-4 sm:py-2 md:px-6 lg:rounded-b-[30px] lg:px-6 lg:py-3 lg:pb-4 lg:shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.12)]">
              {submitError && (
                <p className="mb-2 whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-semibold leading-snug text-red-800 lg:mb-2 lg:text-sm">
                  {submitError}
                </p>
              )}
              {message && (
                <p className="mb-1 text-xs font-medium text-amber-700 max-lg:leading-tight lg:mb-2 lg:text-sm">
                  {message}
                </p>
              )}
              <div className="flex flex-col gap-2 lg:gap-3">
                {/* 題目導覽：與下方「草稿／送出」區隔，維持較好點擊區 */}
                <div className="flex gap-2 lg:gap-3">
                  <button
                    type="button"
                    disabled={safeCurrentIndex === 0}
                    onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
                    className="touch-manipulation inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 bg-gray-50/80 px-3 text-xs font-bold text-gray-800 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 lg:min-h-[48px] lg:rounded-2xl lg:gap-2 lg:px-5 lg:text-sm"
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0" />
                    <span className="lg:hidden">上題</span>
                    <span className="hidden lg:inline">上一題</span>
                  </button>
                  <button
                    type="button"
                    disabled={safeCurrentIndex === questions.length - 1}
                    onClick={() => setCurrentIndex((value) => Math.min(questions.length - 1, value + 1))}
                    className="touch-manipulation inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 bg-gray-50/80 px-3 text-xs font-bold text-gray-800 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 lg:min-h-[48px] lg:rounded-2xl lg:gap-2 lg:px-5 lg:text-sm"
                  >
                    <span className="lg:hidden">下題</span>
                    <span className="hidden lg:inline">下一題</span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                </div>

                {!previewMode && (
                  <div className="flex items-center justify-end gap-1.5 border-t border-dashed border-gray-200/90 pt-2 lg:pt-2.5">
                    <button
                      type="button"
                      disabled={saving || readonly}
                      onClick={saveDraft}
                      className="touch-manipulation inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 text-[10px] font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 lg:h-8 lg:rounded-lg lg:px-3 lg:text-xs"
                    >
                      <Save className="h-3 w-3 shrink-0 opacity-70" />
                      {saving ? '…' : (
                        <>
                          <span className="lg:hidden">草稿</span>
                          <span className="hidden lg:inline">儲存草稿</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={submitting || readonly}
                      onClick={submit}
                      className="touch-manipulation inline-flex h-7 shrink-0 items-center rounded-md bg-amber-500 px-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50 lg:h-8 lg:rounded-lg lg:px-3 lg:text-xs"
                    >
                      {submitting ? '…' : (
                        <>
                          <span className="lg:hidden">送出</span>
                          <span className="hidden lg:inline">送出表單</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-gray-500">目前沒有題目</div>
        )}
      </section>
    </div>
  );
}
