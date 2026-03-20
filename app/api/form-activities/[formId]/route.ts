import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';
import { normalizeFormQuestions } from '@/app/api/_utils/forms';

const prisma = new PrismaClient();

async function getFormWithPermission(formId: string, userId: string, role: string) {
  const form = await prisma.formActivity.findUnique({
    where: { id: formId },
    include: {
      createdBy: { select: { id: true, account: true, name: true } },
      gameModule: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          termId: true,
          term: { select: { id: true, name: true } },
        },
      },
      questions: {
        orderBy: { orderIndex: 'asc' },
        include: { options: { orderBy: { orderIndex: 'asc' } } },
      },
      _count: {
        select: {
          submissions: true,
        },
      },
    },
  });

  if (!form) return null;
  const canEdit = role === 'ADMIN' || form.createdByUserId === userId;
  return { form, canEdit };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ formId: string }> }
) {
  try {
    const user = await getAuthUser(prisma);
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const { formId } = await context.params;
    const result = await getFormWithPermission(formId, user.id, user.role);
    if (!result) {
      return NextResponse.json({ error: '找不到表單' }, { status: 404 });
    }

    const { form, canEdit } = result;
    return NextResponse.json({
      form: {
        id: form.id,
        createdByUserId: form.createdByUserId,
        createdBy: form.createdBy,
        title: form.title,
        description: form.description,
        allowMultipleSubmissions: form.allowMultipleSubmissions,
        allowEditAfterSubmit: form.allowEditAfterSubmit,
        allowViewAfterSubmit: form.allowViewAfterSubmit,
        submissionCount: form._count.submissions,
        gameModule: form.gameModule,
        questions: form.questions.map((question) => ({
          id: question.id,
          title: question.title,
          description: question.description,
          type: question.type,
          isRequired: question.isRequired,
          placeholder: question.placeholder,
          minValue: question.minValue,
          maxValue: question.maxValue,
          options: question.options.map((option) => ({
            id: option.id,
            label: option.label,
            value: option.value,
          })),
        })),
      },
      canEdit,
    });
  } catch (error) {
    console.error('GET /api/form-activities/[formId]:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ formId: string }> }
) {
  try {
    const user = await getAuthUser(prisma);
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const { formId } = await context.params;
    const result = await getFormWithPermission(formId, user.id, user.role);
    if (!result) {
      return NextResponse.json({ error: '找不到表單' }, { status: 404 });
    }
    if (!result.canEdit) {
      return NextResponse.json({ error: '只有建立者和管理員可編輯' }, { status: 403 });
    }

    const body = await request.json();
    const title = String(body.title ?? '').trim();
    const description = String(body.description ?? '').trim();
    const termId = String(body.termId ?? '').trim();

    if (!title) {
      return NextResponse.json({ error: '請填表單名稱' }, { status: 400 });
    }
    if (!termId) {
      return NextResponse.json({ error: '請選活動分類' }, { status: 400 });
    }

    const questions = normalizeFormQuestions(body.questions);
    const term = await prisma.term.findUnique({ where: { id: termId }, select: { id: true } });
    if (!term) {
      return NextResponse.json({ error: '找不到活動分類' }, { status: 404 });
    }
    const allowMultipleSubmissions = Boolean(body.allowMultipleSubmissions);
    const allowEditAfterSubmit = Boolean(body.allowEditAfterSubmit);
    const allowViewAfterSubmit =
      body.allowViewAfterSubmit === undefined ? true : Boolean(body.allowViewAfterSubmit);

    await prisma.$transaction(async (tx) => {
      await tx.gameModule.update({
        where: { id: result.form.gameModuleId },
        data: {
          termId,
          name: title,
          description: description || '表單活動',
        },
      });

      await tx.formActivity.update({
        where: { id: formId },
        data: {
          title,
          description: description || null,
          allowMultipleSubmissions,
          allowEditAfterSubmit,
          allowViewAfterSubmit,
        },
      });

      const existingQuestions = await tx.formQuestion.findMany({
        where: { formActivityId: formId },
        select: { id: true },
      });
      const incomingQuestionIds = questions.map((question) => question.id).filter(Boolean) as string[];
      const questionIdsToDelete = existingQuestions
        .map((question) => question.id)
        .filter((id) => !incomingQuestionIds.includes(id));

      if (questionIdsToDelete.length > 0) {
        await tx.formQuestion.deleteMany({
          where: { id: { in: questionIdsToDelete } },
        });
      }

      for (const [questionIndex, question] of questions.entries()) {
        let currentQuestionId = question.id;
        if (currentQuestionId) {
          await tx.formQuestion.update({
            where: { id: currentQuestionId },
            data: {
              orderIndex: questionIndex,
              title: question.title,
              description: question.description,
              type: question.type,
              isRequired: question.isRequired ?? false,
              placeholder: question.placeholder,
              minValue: question.minValue ?? null,
              maxValue: question.maxValue ?? null,
            },
          });
        } else {
          const createdQuestion = await tx.formQuestion.create({
            data: {
              formActivityId: formId,
              orderIndex: questionIndex,
              title: question.title,
              description: question.description,
              type: question.type,
              isRequired: question.isRequired ?? false,
              placeholder: question.placeholder,
              minValue: question.minValue ?? null,
              maxValue: question.maxValue ?? null,
            },
          });
          currentQuestionId = createdQuestion.id;
        }

        const existingOptions = await tx.formQuestionOption.findMany({
          where: { questionId: currentQuestionId },
          select: { id: true },
        });
        const incomingOptionIds = (question.options ?? [])
          .map((option) => option.id)
          .filter(Boolean) as string[];
        const optionIdsToDelete = existingOptions
          .map((option) => option.id)
          .filter((id) => !incomingOptionIds.includes(id));

        if (optionIdsToDelete.length > 0) {
          await tx.formQuestionOption.deleteMany({
            where: { id: { in: optionIdsToDelete } },
          });
        }

        for (const [optionIndex, option] of (question.options ?? []).entries()) {
          if (option.id) {
            await tx.formQuestionOption.update({
              where: { id: option.id },
              data: {
                orderIndex: optionIndex,
                label: option.label,
                value: option.value,
              },
            });
          } else {
            await tx.formQuestionOption.create({
              data: {
                questionId: currentQuestionId,
                orderIndex: optionIndex,
                label: option.label,
                value: option.value,
              },
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/form-activities/[formId]:', error);
    const message = error instanceof Error ? error.message : '伺服器錯誤';
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    await prisma.$disconnect();
  }
}
