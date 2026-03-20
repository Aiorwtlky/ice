import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, FormSubmissionStatus, UserRole } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';
import { answerToClientValue } from '@/app/api/_utils/forms';

const prisma = new PrismaClient();

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ gameCode: string }> }
) {
  try {
    const user = await getAuthUser(prisma);
    if (!user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const { gameCode } = await context.params;
    const gameModule = await prisma.gameModule.findFirst({
      where: { code: gameCode },
      include: {
        term: { select: { id: true, name: true } },
        formActivity: {
          include: {
            questions: {
              orderBy: { orderIndex: 'asc' },
              include: { options: { orderBy: { orderIndex: 'asc' } } },
            },
          },
        },
      },
    });

    if (!gameModule?.formActivity) {
      return NextResponse.json({ error: '找不到表單活動' }, { status: 404 });
    }

    let submission = null as null | {
      id: string;
      status: FormSubmissionStatus;
      attemptNumber: number;
      submittedAt: string | null;
      answers: Record<string, unknown>;
    };
    let accessState:
      | 'editable'
      | 'submitted_locked_hidden'
      | 'submitted_locked_visible'
      | 'submitted_editable' = 'editable';

    if (user.role === UserRole.STUDENT) {
      const latest = await prisma.formSubmission.findFirst({
        where: {
          formActivityId: gameModule.formActivity.id,
          userId: user.id,
        },
        orderBy: [{ attemptNumber: 'desc' }, { updatedAt: 'desc' }],
        include: { answers: true },
      });

      if (latest) {
        const answers = Object.fromEntries(
          latest.answers.map((answer) => [answer.questionId, answerToClientValue(answer)])
        );

        submission = {
          id: latest.id,
          status: latest.status,
          attemptNumber: latest.attemptNumber,
          submittedAt: latest.submittedAt?.toISOString() ?? null,
          answers,
        };

        if (latest.status === FormSubmissionStatus.SUBMITTED) {
          if (gameModule.formActivity.allowEditAfterSubmit) {
            accessState = 'submitted_editable';
          } else if (gameModule.formActivity.allowViewAfterSubmit) {
            accessState = 'submitted_locked_visible';
          } else {
            accessState = 'submitted_locked_hidden';
          }
        }
      }
    }

    return NextResponse.json({
      form: {
        id: gameModule.formActivity.id,
        title: gameModule.formActivity.title,
        description: gameModule.formActivity.description,
        settings: {
          allowMultipleSubmissions: gameModule.formActivity.allowMultipleSubmissions,
          allowEditAfterSubmit: gameModule.formActivity.allowEditAfterSubmit,
          allowViewAfterSubmit: gameModule.formActivity.allowViewAfterSubmit,
        },
        gameModule: {
          id: gameModule.id,
          code: gameModule.code,
          name: gameModule.name,
        },
        term: gameModule.term,
        questions: gameModule.formActivity.questions.map((question) => ({
          id: question.id,
          orderIndex: question.orderIndex,
          title: question.title,
          description: question.description,
          type: question.type,
          isRequired: question.isRequired,
          placeholder: question.placeholder,
          minValue: question.minValue,
          maxValue: question.maxValue,
          options: question.options.map((option) => ({
            id: option.id,
            orderIndex: option.orderIndex,
            label: option.label,
            value: option.value,
          })),
        })),
      },
      submission,
      accessState,
    });
  } catch (error) {
    console.error('GET /api/form-activities/by-code/[gameCode]:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
