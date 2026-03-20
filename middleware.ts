import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

const ROLE_PATHS: Record<string, string> = {
  STUDENT: '/dashboard/student',
  TEACHER: '/dashboard/teacher',
  ADMIN: '/dashboard/admin',
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/student') || pathname.startsWith('/admin') || pathname.startsWith('/teacher');
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  let role: string;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    role = payload.role as string;
  } catch {
    const res = NextResponse.redirect(new URL('/', request.url));
    res.cookies.delete('auth-token');
    return res;
  }

  const allowedPath = ROLE_PATHS[role];
  if (!allowedPath) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // /dashboard 一律導向該角色專屬儀表板
  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL(allowedPath, request.url));
  }

  // STUDENT：允許 /dashboard/student 及 /student/*；其餘導回
  if (role === 'STUDENT') {
    const ok = pathname.startsWith('/dashboard/student') || pathname.startsWith('/student');
    if (!ok) return NextResponse.redirect(new URL('/dashboard/student', request.url));
    return NextResponse.next();
  }

  // TEACHER：允許 /dashboard/teacher*、班級競賽 /dashboard/competitions* 與共用表單 /dashboard/forms*
  if (role === 'TEACHER') {
    const ok =
      pathname.startsWith('/dashboard/teacher') ||
      pathname.startsWith('/dashboard/competitions') ||
      pathname.startsWith('/dashboard/forms');
    if (!ok) return NextResponse.redirect(new URL('/dashboard/teacher', request.url));
    return NextResponse.next();
  }

  // ADMIN：允許 /dashboard/admin*、班級競賽 /dashboard/competitions* 與共用表單 /dashboard/forms*
  if (role === 'ADMIN') {
    const ok =
      pathname.startsWith('/dashboard/admin') ||
      pathname.startsWith('/dashboard/competitions') ||
      pathname.startsWith('/dashboard/forms');
    if (!ok) return NextResponse.redirect(new URL('/dashboard/admin', request.url));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/student/:path*', '/admin/:path*', '/teacher/:path*'],
};
