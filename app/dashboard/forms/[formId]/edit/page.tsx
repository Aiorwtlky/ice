'use client';

import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import FormBuilder, { FormBuilderInitialData } from '@/components/forms/FormBuilder';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface FormDetailResponse {
  form?: {
    id: string;
    title: string;
    description: string | null;
    allowMultipleSubmissions: boolean;
    allowEditAfterSubmit: boolean;
    allowViewAfterSubmit: boolean;
    submissionCount: number;
    gameModule: {
      code: string;
      termId: string;
    };
    questions: {
      id: string;
      title: string;
      description: string | null;
      type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT' | 'NUMBER';
      isRequired: boolean;
      placeholder: string | null;
      minValue: number | null;
      maxValue: number | null;
      options: { id: string; label: string; value: string }[];
    }[];
  };
  canEdit?: boolean;
  error?: string;
}

export default function EditFormActivityPage() {
  const params = useParams();
  const router = useRouter();
  const formId = typeof params.formId === 'string' ? params.formId : '';
  const { data, isLoading } = useSWR<FormDetailResponse>(
    formId ? `/api/form-activities/${encodeURIComponent(formId)}` : null,
    fetcher
  );

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">表單資料載入中...</p>
      </div>
    );
  }

  if (data.error || !data.form) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FDFBF7] p-6">
        <p className="text-red-600">{data.error || '找不到表單'}</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/forms')}
          className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-white"
        >
          回表單列表
        </button>
      </div>
    );
  }

  const initialData: FormBuilderInitialData = {
    termId: data.form.gameModule.termId,
    title: data.form.title,
    description: data.form.description ?? '',
    allowMultipleSubmissions: data.form.allowMultipleSubmissions,
    allowEditAfterSubmit: data.form.allowEditAfterSubmit,
    allowViewAfterSubmit: data.form.allowViewAfterSubmit,
    questions: data.form.questions.map((question, index) => ({
      id: question.id,
      localId: `${question.id}_${index}`,
      title: question.title,
      description: question.description ?? '',
      type: question.type,
      isRequired: question.isRequired,
      placeholder: question.placeholder ?? '',
      minValue: question.minValue === null ? '' : String(question.minValue),
      maxValue: question.maxValue === null ? '' : String(question.maxValue),
      options: question.options.map((option, optionIndex) => ({
        id: option.id,
        localId: `${option.id}_${optionIndex}`,
        label: option.label,
        value: option.value,
      })),
    })),
  };

  return (
    <FormBuilder
      submitUrl={`/api/form-activities/${encodeURIComponent(formId)}`}
      submitMethod="PATCH"
      initialData={initialData}
      pageTitle={data.canEdit ? '編輯表單活動' : '查看表單活動'}
      pageDescription={
        data.canEdit
          ? '只有建立者與管理員可編輯。若已經有學生作答，請留意調整題目結構會影響後續資料解讀。'
          : '你可以查看此表單設定，但只有建立者與管理員可修改。'
      }
      saveLabel="儲存表單修改"
      successMessage="表單修改已儲存"
      returnPath="/dashboard/forms"
      readonly={!data.canEdit}
    />
  );
}
