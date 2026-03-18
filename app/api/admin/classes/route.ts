import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId as string }, select: { role: true } });
    return user?.role === 'ADMIN';
  } catch { return null; }
}

/** GET: 所有班級與負責教師（主講師 + 指派教師） */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const classes = await prisma.classGroup.findMany({
    include: {
      activeTerm: { select: { id: true, name: true } },
      teacher: { select: { id: true, account: true, name: true } },
      teachers: { include: { user: { select: { id: true, account: true, name: true } } } },
      _count: { select: { students: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const list = classes.map((c) => ({
    id: c.id,
    name: c.name,
    schoolCode: c.schoolCode,
    termId: c.activeTermId,
    termName: c.activeTerm?.name,
    mainTeacher: c.teacher,
    assignedTeachers: c.teachers.map((t) => t.user),
    studentCount: c._count.students,
  }));
  return NextResponse.json({ classes: list });
}

/** POST: 創立班級（僅需名稱、代碼、主講師；活動分類可之後在班級編輯中綁定） */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const body = await request.json();
  const { name, schoolCode, teacherId, activeTermId } = body;
  if (!name || !schoolCode || !teacherId) {
    return NextResponse.json({ error: '請提供 name, schoolCode, teacherId（主講師）' }, { status: 400 });
  }
  const teacher = await prisma.user.findUnique({ where: { id: teacherId }, select: { role: true } });
  if (teacher?.role !== 'TEACHER') return NextResponse.json({ error: '主講師須為教師帳號' }, { status: 400 });
  let termId: string | null = null;
  if (typeof activeTermId === 'string' && activeTermId) {
    const term = await prisma.term.findUnique({ where: { id: activeTermId } });
    if (!term) return NextResponse.json({ error: '活動分類不存在' }, { status: 400 });
    termId = activeTermId;
  }
  const created = await prisma.classGroup.create({
    data: { name: String(name), schoolCode: String(schoolCode), teacherId, activeTermId: termId },
  });
  return NextResponse.json({ classGroup: created });
}
