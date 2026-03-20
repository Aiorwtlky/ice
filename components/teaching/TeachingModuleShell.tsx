'use client';

import type { ReactNode } from 'react';

export function TeachingModuleShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-b from-[#FDFBF7] to-white">
      <header className="shrink-0 border-b border-amber-200/80 bg-white/95 px-4 py-3 shadow-sm">
        <h1 className="text-lg font-extrabold text-gray-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-xs text-gray-600">{subtitle}</p> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable]">{children}</div>
    </div>
  );
}
