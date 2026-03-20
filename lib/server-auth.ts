import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');

export type SessionUser = {
  id: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  studentGroupId: string | null;
  teacherGroupIds: string[];
  assignedClassIds: string[];
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        studentGroupId: true,
        teacherGroups: { select: { id: true } },
        classGroupTeacherAssignments: { select: { classGroupId: true } },
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      role: user.role,
      studentGroupId: user.studentGroupId,
      teacherGroupIds: user.teacherGroups.map((g) => g.id),
      assignedClassIds: user.classGroupTeacherAssignments.map((a) => a.classGroupId),
    };
  } catch {
    return null;
  }
}

export function teacherManagedClassIds(u: SessionUser): string[] {
  return [...new Set([...u.teacherGroupIds, ...u.assignedClassIds])];
}

export function canTeacherAccessClass(u: SessionUser, classGroupId: string): boolean {
  if (u.role === 'ADMIN') return true;
  if (u.role !== 'TEACHER') return false;
  return teacherManagedClassIds(u).includes(classGroupId);
}
