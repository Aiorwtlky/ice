'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-600">導向首頁...</p>
    </div>
  );
}
