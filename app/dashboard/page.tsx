'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    // 取得使用者資訊並根據角色導向
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          const role = data.user.role;
          if (role === 'STUDENT') {
            router.replace('/dashboard/student');
          } else if (role === 'TEACHER') {
            router.replace('/dashboard/teacher');
          } else if (role === 'ADMIN') {
            router.replace('/dashboard/admin');
          } else {
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>載入中...</p>
    </div>
  );
}
