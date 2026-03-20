import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function logAnnouncementAction(opts: {
  userId: string;
  classGroupId: string | null;
  action: string;
  payload?: Record<string, unknown>;
}) {
  await prisma.systemLog.create({
    data: {
      userId: opts.userId,
      classGroupId: opts.classGroupId ?? undefined,
      action: opts.action,
      payload: opts.payload ? (opts.payload as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function logAnnouncementLearning(opts: {
  userId: string;
  actionType: string;
  detail?: Record<string, unknown>;
}) {
  await prisma.learningLog.create({
    data: {
      userId: opts.userId,
      gameModuleId: null,
      actionType: opts.actionType,
      detail: opts.detail ? (opts.detail as Prisma.InputJsonValue) : undefined,
    },
  });
}
