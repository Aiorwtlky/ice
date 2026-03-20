import { PrismaClient, UserRole } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

export interface AuthUser {
  id: string;
  account: string;
  name: string | null;
  role: UserRole;
  studentGroupId: string | null;
  teacherGroupIds: string[];
}

export async function getAuthUser(prisma: PrismaClient): Promise<AuthUser | null> {
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
        account: true,
        name: true,
        role: true,
        studentGroupId: true,
        teacherGroups: { select: { id: true } },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      account: user.account,
      name: user.name,
      role: user.role,
      studentGroupId: user.studentGroupId ?? null,
      teacherGroupIds: user.teacherGroups.map((group) => group.id),
    };
  } catch {
    return null;
  }
}
