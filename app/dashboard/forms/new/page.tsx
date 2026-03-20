'use client';

import FormBuilder from '@/components/forms/FormBuilder';

export default function NewFormActivityPage() {
  return (
    <FormBuilder
      submitUrl="/api/form-activities"
      submitMethod="POST"
      pageTitle="新增表單活動"
      pageDescription="建好後會直接進入既有活動系統，老師中控台可開放/關閉，學生端會看到這份表單。"
      saveLabel="建立表單活動"
      successMessage="表單活動已建立"
      returnPath="/dashboard/forms"
    />
  );
}
