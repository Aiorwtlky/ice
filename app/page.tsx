'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, LogIn, Sparkles } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '登入失敗');
        setLoading(false);
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('網路錯誤，請稍後再試');
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen min-h-[480px] flex-col overflow-hidden bg-[#FDFBF7]">
      <div className="flowing-bg" aria-hidden="true">
        <div className="tech-blob tech-blob-1" />
        <div className="tech-blob tech-blob-2" />
        <div className="tech-blob tech-blob-3" />
      </div>

      <header className="shrink-0 border-b border-gray-200/60 bg-white/95 backdrop-blur-sm z-50 w-full">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-6">
          <span className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <BookOpen className="h-6 w-6 text-amber-600" />
            NovaInsight 資訊科普教育平台
          </span>
        </div>
      </header>

      <main className="relative min-h-0 flex-1 overflow-y-auto px-4 py-8 md:py-12 lg:py-16">
        {/* 科技感：細網格 + 光暈（不影響內容點擊） */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(17,24,39,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(17,24,39,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/30 blur-3xl" />
          <div className="absolute -bottom-28 right-[-3rem] h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" />
        </div>
        <div className="mx-auto max-w-5xl">
          {/* 歡迎區 */}
          <section className="mb-10 text-center md:mb-14">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-800">
              <Sparkles className="h-4 w-4" />
              歡迎使用
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl lg:text-5xl">
              NovaInsight 資訊科普教育平台
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 md:text-xl">
              用互動式小遊戲與任務，協助學生培養運算思維與問題解決能力；老師可即時開放活動、查看學習數據並示範操作流程。
            </p>
          </section>

          {/* 登入區 */}
          <section className="mx-auto max-w-md">
            <div className="rounded-2xl border border-gray-200/80 bg-white/95 p-6 shadow-lg shadow-gray-200/50 backdrop-blur-sm md:p-8">
              <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900">
                <LogIn className="h-5 w-5 text-amber-600" />
                登入
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="account" className="mb-1.5 block text-sm font-medium text-gray-700">
                    帳號
                  </label>
                  <input
                    id="account"
                    type="text"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    required
                    placeholder="例：ST-01、TC-ML01"
                    disabled={loading}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                    密碼
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="請輸入密碼"
                    disabled={loading}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-amber-500 py-3 font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                >
                  {loading ? '登入中...' : '登入'}
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>

      <footer className="shrink-0 border-t border-gray-200/60 bg-white/80 py-4 backdrop-blur-sm">
        <div className="space-y-0.5 text-center text-sm text-gray-500 md:text-base">
          <p>教育部帶動中小學計畫</p>
          <p>Google Developer Groups on Campus NTUB</p>
          <p className="text-xs text-gray-400 md:text-sm">© 2026</p>
        </div>
      </footer>
    </div>
  );
}
