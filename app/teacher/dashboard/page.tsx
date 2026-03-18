'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TeacherDashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/teacher');
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-600">導向老師儀表板...</p>
    </div>
  );
}
