import { FormQuestionType } from '@prisma/client';

export interface FormQuestionInput {
  id?: string;
  title: string;
  description?: string | null;
  type: FormQuestionType;
  isRequired?: boolean;
  placeholder?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  options?: { id?: string; label: string; value: string }[];
}

export function createFormGameCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FORM_${stamp}_${suffix}`;
}

export function normalizeFormQuestions(input: unknown): FormQuestionInput[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('至少需要 1 題');
  }

  return input.map((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw new Error(`第 ${index + 1} 題格式錯誤`);
    }

    const question = raw as Record<string, unknown>;
    const id = typeof question.id === 'string' ? question.id : undefined;
    const title = String(question.title ?? '').trim();
    const type = String(question.type ?? '').trim() as FormQuestionType;
    const description = String(question.description ?? '').trim();
    const placeholder = String(question.placeholder ?? '').trim();
    const isRequired = Boolean(question.isRequired);

    if (!title) {
      throw new Error(`第 ${index + 1} 題請填題目`);
    }

    if (!Object.values(FormQuestionType).includes(type)) {
      throw new Error(`第 ${index + 1} 題的題型不支援`);
    }

    const options: { id?: string; label: string; value: string }[] = [];
    if (Array.isArray(question.options)) {
      question.options.forEach((option, optionIndex) => {
        const row = (option ?? {}) as Record<string, unknown>;
        const id = typeof row.id === 'string' ? row.id : undefined;
        const label = String(row.label ?? '').trim();
        const value = String(row.value ?? (label || `option_${optionIndex + 1}`)).trim();
        if (!label) return;
        options.push({ id, label, value });
      });
    }

    if (
      (type === FormQuestionType.SINGLE_CHOICE ||
        type === FormQuestionType.MULTIPLE_CHOICE) &&
      options.length < 2
    ) {
      throw new Error(`第 ${index + 1} 題至少需要 2 個選項`);
    }

    const minValue =
      question.minValue === null || question.minValue === undefined || question.minValue === ''
        ? null
        : Number(question.minValue);
    const maxValue =
      question.maxValue === null || question.maxValue === undefined || question.maxValue === ''
        ? null
        : Number(question.maxValue);

    if (minValue !== null && Number.isNaN(minValue)) {
      throw new Error(`第 ${index + 1} 題的最小值格式錯誤`);
    }
    if (maxValue !== null && Number.isNaN(maxValue)) {
      throw new Error(`第 ${index + 1} 題的最大值格式錯誤`);
    }

    return {
      id,
      title,
      description: description || null,
      type,
      isRequired,
      placeholder: placeholder || null,
      minValue,
      maxValue,
      options,
    };
  });
}

export function isAnswerEmpty(value: unknown, type: FormQuestionType) {
  if (type === FormQuestionType.MULTIPLE_CHOICE) {
    return !Array.isArray(value) || value.length === 0;
  }
  if (type === FormQuestionType.NUMBER) {
    return value === '' || value === null || value === undefined || Number.isNaN(Number(value));
  }
  return String(value ?? '').trim() === '';
}

export function toAnswerColumns(value: unknown, type: FormQuestionType) {
  if (type === FormQuestionType.NUMBER) {
    return {
      answerText: undefined,
      answerNumber: Number(value),
      answerJson: undefined,
    };
  }

  if (type === FormQuestionType.MULTIPLE_CHOICE) {
    return {
      answerText: undefined,
      answerNumber: undefined,
      answerJson: Array.isArray(value) ? value : [],
    };
  }

  if (type === FormQuestionType.SINGLE_CHOICE) {
    return {
      answerText: String(value ?? ''),
      answerNumber: undefined,
      answerJson: undefined,
    };
  }

  return {
    answerText: String(value ?? ''),
    answerNumber: undefined,
    answerJson: undefined,
  };
}

export function answerToClientValue(answer: {
  answerText: string | null;
  answerNumber: number | null;
  answerJson: unknown;
}) {
  if (Array.isArray(answer.answerJson)) return answer.answerJson;
  if (answer.answerNumber !== null && answer.answerNumber !== undefined) return answer.answerNumber;
  return answer.answerText ?? '';
}
