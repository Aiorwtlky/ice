import type { PrismaClient, UserRole } from '@prisma/client';
import type { AuthUser } from '@/app/api/_utils/auth';

export async function loadAuthTeacherGroups(prisma: PrismaClient, userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      teacherGroups: { select: { id: true } },
      classGroupTeacherAssignments: { select: { classGroupId: true } },
    },
  });
  if (!u) return [];
  const fromMain = u.teacherGroups.map((g) => g.id);
  const fromAssign = u.classGroupTeacherAssignments.map((a) => a.classGroupId);
  return [...new Set([...fromMain, ...fromAssign])];
}

export function canManageClass(auth: AuthUser, classGroupId: string, teacherGroupIds: string[]): boolean {
  if (auth.role === 'ADMIN') return true;
  if (auth.role === 'TEACHER') return teacherGroupIds.includes(classGroupId);
  return false;
}

export function assertStudentInClass(auth: AuthUser, classGroupId: string): boolean {
  return auth.role === 'STUDENT' && auth.studentGroupId === classGroupId;
}

export function isStaff(role: UserRole): boolean {
  return role === 'TEACHER' || role === 'ADMIN';
}
