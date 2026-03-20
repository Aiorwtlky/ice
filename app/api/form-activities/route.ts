import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';
import { createFormGameCode, normalizeFormQuestions } from '@/app/api/_utils/forms';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(prisma);
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const termId = searchParams.get('termId') ?? undefined;

    const forms = await prisma.formActivity.findMany({
      where: {
        ...(termId ? { gameModule: { termId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, account: true, name: true } },
        gameModule: {
          select: {
            id: true,
            code: true,
            name: true,
            termId: true,
            term: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            questions: true,
            submissions: true,
          },
        },
      },
    });

    return NextResponse.json({
      forms: forms.map((form) => ({
        id: form.id,
        title: form.title,
        description: form.description,
        allowMultipleSubmissions: form.allowMultipleSubmissions,
        allowEditAfterSubmit: form.allowEditAfterSubmit,
        allowViewAfterSubmit: form.allowViewAfterSubmit,
        createdAt: form.createdAt.toISOString(),
        updatedAt: form.updatedAt.toISOString(),
        canEdit: user.role === 'ADMIN' || form.createdByUserId === user.id,
        createdBy: form.createdBy,
        gameModule: form.gameModule,
        questionCount: form._count.questions,
        submissionCount: form._count.submissions,
      })),
    });
  } catch (error) {
    console.error('GET /api/form-activities:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(prisma);
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
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
    const gameCode = createFormGameCode();

    const result = await prisma.$transaction(async (tx) => {
      const gameModule = await tx.gameModule.create({
        data: {
          termId,
          code: gameCode,
          name: title,
          description: description || '表單活動',
        },
      });

      const form = await tx.formActivity.create({
        data: {
          gameModuleId: gameModule.id,
          createdByUserId: user.id,
          title,
          description: description || null,
          allowMultipleSubmissions,
          allowEditAfterSubmit,
          allowViewAfterSubmit,
          questions: {
            create: questions.map((question, questionIndex) => ({
              orderIndex: questionIndex,
              title: question.title,
              description: question.description,
              type: question.type,
              isRequired: question.isRequired ?? false,
              placeholder: question.placeholder,
              minValue: question.minValue ?? null,
              maxValue: question.maxValue ?? null,
              options: {
                create: (question.options ?? []).map((option, optionIndex) => ({
                  orderIndex: optionIndex,
                  label: option.label,
                  value: option.value,
                })),
              },
            })),
          },
        },
        include: {
          questions: { include: { options: true }, orderBy: { orderIndex: 'asc' } },
          gameModule: { select: { id: true, code: true, termId: true } },
        },
      });

      return form;
    });

    return NextResponse.json({ form: result }, { status: 201 });
  } catch (error) {
    console.error('POST /api/form-activities:', error);
    const message = error instanceof Error ? error.message : '伺服器錯誤';
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    await prisma.$disconnect();
  }
}
