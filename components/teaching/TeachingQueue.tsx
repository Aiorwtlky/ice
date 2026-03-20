'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowBigLeft, ArrowBigRight } from 'lucide-react';

type QItem = { id: number; v: string };

const LAYOUT_SLOW = { type: 'spring' as const, stiffness: 72, damping: 22, mass: 0.95 };

export function TeachingQueue() {
  const [input, setInput] = useState('1');
  const [queue, setQueue] = useState<QItem[]>([]);
  const idRef = useRef(0);

  const enqueue = () => {
    const v = input.trim() || '?';
    idRef.current += 1;
    setQueue((q) => [...q, { id: idRef.current, v }]);
    const next = (parseInt(input, 10) || 0) + 1;
    setInput(String(next));
  };

  const dequeue = () => {
    setQueue((q) => q.slice(1));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-h-[260px] flex-1 flex-col rounded-2xl border-2 border-sky-300 bg-gradient-to-r from-sky-50 to-white p-4 shadow-inner">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-sky-600">Queue（佇列）</p>
        <div className="relative flex flex-1 flex-col justify-center">
          <div className="relative mx-auto w-full max-w-2xl rounded-2xl border-y-4 border-x-2 border-sky-400 bg-sky-50/60 py-6 pl-4 pr-10">
            <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-bold">
              <span className="flex items-center gap-0.5 text-blue-600">
                <ArrowBigLeft className="h-5 w-5" /> Front
              </span>
              <span className="flex items-center gap-0.5 text-emerald-700">
                Rear <ArrowBigRight className="h-5 w-5" />
              </span>
            </div>
            <div className="flex min-h-[72px] flex-row items-center gap-2 overflow-x-auto overflow-y-visible px-1 py-2">
              <AnimatePresence initial={false}>
                {queue.map((item, i) => {
                  const isFront = i === 0;
                  const isRear = i === queue.length - 1;
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={
                        isRear
                          ? { x: 100, opacity: 0, scale: 0.9 }
                          : false
                      }
                      animate={{ x: 0, opacity: 1, scale: 1 }}
                      exit={{ x: -100, opacity: 0 }}
                      transition={{
                        layout: LAYOUT_SLOW,
                        opacity: { duration: 0.45 },
                        x: { type: 'spring', stiffness: 95, damping: 22, mass: 0.95 },
                      }}
                      className={`relative flex min-w-[3.5rem] shrink-0 items-center justify-center rounded-lg border-2 px-3 py-2 text-sm font-bold shadow-sm ${
                        isFront ? 'border-blue-500 bg-blue-100 text-blue-950' : isRear ? 'border-emerald-500 bg-emerald-100 text-emerald-950' : 'border-sky-300 bg-white text-sky-950'
                      }`}
                    >
                      {item.v}
                      {isFront && (
                        <span className="absolute -top-6 left-1/2 flex -translate-x-1/2 text-[9px] font-black text-blue-600">Front</span>
                      )}
                      {isRear && queue.length > 1 && (
                        <span className="absolute -bottom-6 left-1/2 flex -translate-x-1/2 text-[9px] font-black text-emerald-700">Rear</span>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            {queue.length === 0 && (
              <p className="text-center text-xs text-sky-500">空佇列：Enqueue 從右側進入</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-sm shrink-0 flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 lg:max-w-md">
        <h3 className="text-sm font-extrabold text-sky-950">操作</h3>
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
            onClick={enqueue}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700"
          >
            Enqueue
          </button>
          <button
            type="button"
            onClick={dequeue}
            disabled={queue.length === 0}
            className="rounded-xl border border-sky-400 bg-white px-4 py-2 text-sm font-bold text-sky-900 disabled:opacity-40"
          >
            Dequeue
          </button>
        </div>
        <div className="rounded-xl border border-sky-200/80 bg-white/90 p-3 text-sm leading-relaxed text-sky-950">
          <p className="font-bold text-sky-900">FIFO（先進先出）</p>
          <p className="mt-1 text-xs text-sky-900/85">
            從 Rear（尾端）排入，從 Front（前端）離開。出列時其餘元素會向左補位。
          </p>
        </div>
      </div>
    </div>
  );
}
