import { NextRequest, NextResponse } from 'next/server';
import { FormSubmissionStatus, PrismaClient, UserRole } from '@prisma/client';
import { getAuthUser } from '@/app/api/_utils/auth';
import { isAnswerEmpty, toAnswerColumns } from '@/app/api/_utils/forms';

const prisma = new PrismaClient();

async function resolveSubmission(args: {
  prisma: PrismaClient;
  formActivityId: string;
  userId: string;
  allowMultipleSubmissions: boolean;
  allowEditAfterSubmit: boolean;
}) {
  const latest = await args.prisma.formSubmission.findFirst({
    where: { formActivityId: args.formActivityId, userId: args.userId },
    orderBy: [{ attemptNumber: 'desc' }, { updatedAt: 'desc' }],
  });

  if (!latest) {
    return args.prisma.formSubmission.create({
      data: {
        formActivityId: args.formActivityId,
        userId: args.userId,
        status: FormSubmissionStatus.DRAFT,
        attemptNumber: 1,
      },
    });
  }

  if (latest.status === FormSubmissionStatus.DRAFT) {
    return latest;
  }

  if (!args.allowMultipleSubmissions && !args.allowEditAfterSubmit) {
    throw new Error('這份表單已送出');
  }

  if (!args.allowMultipleSubmissions && args.allowEditAfterSubmit) {
    return args.prisma.formSubmission.update({
      where: { id: latest.id },
      data: { status: FormSubmissionStatus.DRAFT },
    });
  }

  return args.prisma.formSubmission.create({
    data: {
      formActivityId: args.formActivityId,
      userId: args.userId,
      status: FormSubmissionStatus.DRAFT,
      attemptNumber: latest.attemptNumber + 1,
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameCode: string }> }
) {
  try {
    const user = await getAuthUser(prisma);
    if (!user || user.role !== UserRole.STUDENT) {
      return NextResponse.json({ error: '只有學生可以送出表單' }, { status: 403 });
    }

    const { gameCode } = await context.params;
    const body = await request.json();
    const answers =
      body.answers && typeof body.answers === 'object'
        ? (body.answers as Record<string, unknown>)
        : {};

    const gameModule = await prisma.gameModule.findFirst({
      where: { code: gameCode },
      include: {
        formActivity: {
          include: {
            questions: { orderBy: { orderIndex: 'asc' } },
          },
        },
      },
    });

    if (!gameModule?.formActivity) {
      return NextResponse.json({ error: '找不到表單活動' }, { status: 404 });
    }

    const missingRequired = gameModule.formActivity.questions
      .filter((question) => question.isRequired && isAnswerEmpty(answers[question.id], question.type))
      .map((question) => question.title);

    if (missingRequired.length > 0) {
      return NextResponse.json(
        { error: `尚有必填題未完成：${missingRequired.join('、')}` },
        { status: 400 }
      );
    }

    const submission = await resolveSubmission({
      prisma,
      formActivityId: gameModule.formActivity.id,
      userId: user.id,
      allowMultipleSubmissions: gameModule.formActivity.allowMultipleSubmissions,
      allowEditAfterSubmit: gameModule.formActivity.allowEditAfterSubmit,
    });

    for (const question of gameModule.formActivity.questions) {
      const value = answers[question.id];
      if (isAnswerEmpty(value, question.type)) {
        await prisma.formAnswer.deleteMany({
          where: { submissionId: submission.id, questionId: question.id },
        });
        continue;
      }

      await prisma.formAnswer.upsert({
        where: {
          submissionId_questionId: {
            submissionId: submission.id,
            questionId: question.id,
          },
        },
        create: {
          submissionId: submission.id,
          questionId: question.id,
          ...toAnswerColumns(value, question.type),
        },
        update: toAnswerColumns(value, question.type),
      });
    }

    await prisma.formSubmission.update({
      where: { id: submission.id },
      data: {
        status: FormSubmissionStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    await prisma.formAnswerLog.create({
      data: {
        formActivityId: gameModule.formActivity.id,
        submissionId: submission.id,
        userId: user.id,
        actionType: 'SUBMIT',
        detail: {
          source: 'student',
          answerCount: Object.keys(answers).length,
        },
      },
    });

    await prisma.learningLog.create({
      data: {
        userId: user.id,
        gameModuleId: gameModule.id,
        actionType: 'COMPLETE',
        detail: {
          submissionId: submission.id,
          formTitle: gameModule.formActivity.title,
        },
      },
    });

    await prisma.systemLog.create({
      data: {
        userId: user.id,
        classGroupId: user.studentGroupId ?? undefined,
        gameModuleId: gameModule.id,
        action: 'FORM_SUBMIT',
        payload: {
          submissionId: submission.id,
          formTitle: gameModule.formActivity.title,
        },
      },
    });

    return NextResponse.json({ success: true, submissionId: submission.id });
  } catch (error) {
    console.error('POST /api/form-activities/by-code/[gameCode]/submit:', error);
    const message = error instanceof Error ? error.message : '伺服器錯誤';
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    await prisma.$disconnect();
  }
}
