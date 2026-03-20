'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowBigUp } from 'lucide-react';

/** 較慢、好跟的彈簧（教學節奏） */
const SLOW = { type: 'spring' as const, stiffness: 130, damping: 22 };
const PUSH_IN = { type: 'spring' as const, stiffness: 160, damping: 14, mass: 0.85 };

export function TeachingStack() {
  const [input, setInput] = useState('A');
  const [stack, setStack] = useState<string[]>([]);

  const push = () => {
    const v = input.trim() || '?';
    setStack((s) => [...s, v]);
  };

  const pop = () => {
    setStack((s) => s.slice(0, -1));
  };

  const topIdx = stack.length - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center rounded-2xl border-2 border-slate-300 bg-gradient-to-b from-slate-100 to-white p-4 shadow-inner">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Stack（堆疊）</p>
        {/* U 型容器 */}
        <div className="relative flex h-[min(52vh,420px)] w-full max-w-sm flex-col items-center">
          <div className="relative flex w-[72%] flex-1 flex-col items-center justify-end border-x-4 border-b-4 border-slate-400 rounded-b-3xl bg-slate-50/80 px-2 pb-1 pt-8">
            <div className="flex w-full flex-col-reverse items-center gap-1.5 overflow-hidden pb-2">
              <AnimatePresence initial={false}>
                {stack.map((item, i) => {
                  const isTop = i === topIdx;
                  return (
                    <motion.div
                      key={`${item}-${i}-${stack.length}`}
                      layout
                      initial={i === stack.length - 1 ? { y: -140, opacity: 0, scale: 0.82 } : false}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: -130, opacity: 0, scale: 0.75 }}
                      transition={
                        i === stack.length - 1
                          ? { y: PUSH_IN, opacity: { duration: 0.35 } }
                          : SLOW
                      }
                      className="relative flex w-[88%] max-w-[220px] items-center justify-center rounded-lg border-2 border-amber-400 bg-amber-100 py-2 text-sm font-bold text-amber-950 shadow-sm"
                    >
                      {isTop && (
                        <motion.span
                          className="absolute -right-8 top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-red-600 drop-shadow-sm"
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        >
                          <ArrowBigUp className="h-6 w-6 shrink-0" aria-hidden />
                          <span className="text-[10px] font-black">Top</span>
                        </motion.span>
                      )}
                      {item}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            {stack.length === 0 && (
              <p className="absolute bottom-6 text-center text-xs text-slate-400">空堆疊：試著 Push 一個元素</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-sm shrink-0 flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 lg:max-w-md">
        <h3 className="text-sm font-extrabold text-amber-950">操作</h3>
        <div className="flex flex-wrap gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-w-[6rem] flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            placeholder="標籤"
            maxLength={8}
          />
          <button
            type="button"
            onClick={push}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
          >
            Push
          </button>
          <button
            type="button"
            onClick={pop}
            disabled={stack.length === 0}
            className="rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-bold text-amber-900 disabled:opacity-40"
          >
            Pop
          </button>
        </div>
        <div className="rounded-xl border border-amber-200/80 bg-white/90 p-3 text-sm leading-relaxed text-amber-950">
          <p className="font-bold text-amber-900">LIFO（後進先出）</p>
          <p className="mt-1 text-xs text-amber-900/85">
            最後放進堆疊的元素會最先被取出。就像疊盤子：只能從最上面拿。
          </p>
        </div>
      </div>
    </div>
  );
}
