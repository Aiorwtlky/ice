'use client';

import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';

function optimalSteps(n: number) {
  return Math.pow(2, n) - 1;
}

function discColor(level: number, n: number) {
  const t = n <= 1 ? 0 : (level - 1) / (n - 1);
  const hue = 35 + Math.round(180 * t); // amber -> teal
  return `hsl(${hue} 85% 55%)`;
}

function buildHanoiHelpHint(
  n: number,
  rods: number[][],
  picked: { from: 0 | 1 | 2; disc: number } | null,
  done: boolean,
  steps: number
): string {
  const name = (i: 0 | 1 | 2) => (i === 0 ? '左' : i === 1 ? '中' : '右');
  if (done) {
    return '你已經過關了！想再挑戰可按右上角的「重來」；要離開請用畫面上的「返回」。';
  }
  if (picked) {
    return `你現在拿著盤子 ${picked.disc}（柱子上最上面、最小的那個）。請點「${name(0)}、${name(1)}、${name(2)}」裡的另一根柱子把盤子放過去。若只是誤觸、想先放回去，再點一次「${name(picked.from)}柱」就好，不會算一步喔。`;
  }
  const allOnLeft = rods[0].length === n && rods[1].length === 0 && rods[2].length === 0;
  if (allOnLeft) {
    return '還沒開始搬呢。請先點「左柱」拿起最上面最小的盤子，再點「中柱」或「右柱」放下去。規則是：一次只能動一個盤子，而且大盤不可以壓在小盤上面，最後要全部疊到「右柱」。';
  }
  const onRight = rods[2].length;
  if (onRight >= 1 && onRight < n) {
    return `右柱已經有 ${onRight} 個盤子了，方向正確！繼續搬，目標是右柱疊滿 ${n} 個，而且下面大、上面小。卡住時想想看：有時要先暫時移到中柱「讓路」。`;
  }
  if (rods[0].length === 0 && onRight < n) {
    return '左柱已經空了，盤子在中柱和右柱之間。每一步都要遵守「大不壓小」；可能需要來回調度，慢慢來沒關係。';
  }
  if (steps === 0) {
    return '請點「有盤子的那一柱」拿起最上面一個，再點另一柱完成一步。全部搬到右柱就過關；完整規則可看「規則」按鈕（手機）或右側說明（電腦）。';
  }
  return '點有盤子的柱子會拿起最上面那一個，再點目的地放下。大盤不能蓋小盤；想從頭練習可按「重來」。';
}

const HanoiGame = forwardRef<
  { openHelp: () => void },
  {
    n: number;
    sendLog: (action: string, opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }) => Promise<void>;
    onExit: () => void;
  }
>(function HanoiGame({ n, sendLog, onExit }, ref) {
  const [rods, setRods] = useState<number[][]>(() => [Array.from({ length: n }, (_, i) => n - i), [], []]);
  const [picked, setPicked] = useState<{ from: 0 | 1 | 2; disc: number } | null>(null);
  const [steps, setSteps] = useState(0);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpHint, setHelpHint] = useState('');

  useImperativeHandle(
    ref,
    () => ({
      openHelp: () => {
        setHelpHint(buildHanoiHelpHint(n, rods, picked, done, steps));
        setHelpOpen(true);
      },
    }),
    [n, rods, picked, done, steps]
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(id);
  }, [toast]);

  const tryPickOrDrop = (rodIdx: 0 | 1 | 2) => {
    if (done) return;

    // pick
    if (!picked) {
      const stack = rods[rodIdx];
      if (!stack.length) return;
      const disc = stack[stack.length - 1];
      setPicked({ from: rodIdx, disc });
      sendLog('PICK', { payload: { discLevel: disc, fromRod: rodIdx } });
      return;
    }

    // drop
    const disc = picked.disc;
    const from = picked.from;
    // 點回原柱：取消拿起，不計步（尚未完成一次移動）
    if (rodIdx === from) {
      setPicked(null);
      return;
    }

    const destStack = rods[rodIdx];
    const top = destStack[destStack.length - 1];
    const legal = top === undefined || disc < top;
    sendLog('DROP', { payload: { discLevel: disc, fromRod: from, toRod: rodIdx, legal } });

    if (!legal) {
      setToast('不行喔！大盤子不能放在小盤子上');
      return;
    }

    setRods((prev) => {
      const next = prev.map((r) => [...r]) as [number[], number[], number[]];
      next[from].pop();
      next[rodIdx].push(disc);
      return next;
    });
    setPicked(null);
    setSteps((s) => s + 1);
  };

  useEffect(() => {
    if (done) return;
    if (rods[2].length === n) {
      setDone(true);
      sendLog('SUCCESS', { isCorrect: true, payload: { steps, optimal: optimalSteps(n), discs: n } });
    }
  }, [done, rods, n, sendLog, steps]);

  const reset = () => {
    setRods([Array.from({ length: n }, (_, i) => n - i), [], []]);
    setPicked(null);
    setSteps(0);
    setDone(false);
    sendLog('RESET', { payload: { discs: n } });
  };

  const optimal = optimalSteps(n);

  const discHClass =
    n >= 5
      ? 'h-[0.62rem] min-h-[10px] sm:h-7 lg:h-12'
      : n === 4
        ? 'h-5 sm:h-8 lg:h-12'
        : 'h-6 sm:h-9 lg:h-12';
  const discGapClass = n >= 5 ? 'gap-px sm:gap-1 lg:gap-2' : 'gap-1 sm:gap-1.5 lg:gap-2';

  const rulesCardInner = (
    <>
      <h2 className="text-base font-extrabold tracking-tight text-gray-900 sm:text-lg">河內塔（{n} 層）</h2>
      <p className="mt-1 text-xs text-gray-600 sm:text-sm">
        把所有盤子搬到<span className="font-semibold text-amber-700">最右邊</span>就過關。
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800 sm:text-xs">目前步數</div>
          <div className="text-xl font-extrabold tabular-nums text-gray-900 sm:text-2xl">{steps}</div>
        </div>
        <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 sm:text-xs">最低步數</div>
          <div className="text-xl font-extrabold tabular-nums text-gray-900 sm:text-2xl">{optimal}</div>
        </div>
      </div>
      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="text-xs font-bold text-gray-500">遊戲規則</p>
        <ul className="mt-2 space-y-2 text-xs leading-relaxed text-gray-600 sm:text-sm">
          <li className="flex gap-2"><span className="font-bold text-amber-600">①</span>一次只能移動一個盤子</li>
          <li className="flex gap-2"><span className="font-bold text-amber-600">②</span>大盤子不能放在小盤子上面</li>
          <li className="flex gap-2"><span className="font-bold text-amber-600">③</span>盤子要整疊移到右柱</li>
        </ul>
      </div>
    </>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col lg:flex-row lg:gap-5 lg:p-1">
      {/* 小螢幕：頂列分數 + 規則（電腦 lg+ 維持右側完整卡） */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white/95 px-2 py-2 lg:hidden">
        <span className="shrink-0 text-xs font-extrabold text-gray-800">河內塔 {n} 層</span>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-center">
            <div className="text-[9px] font-bold text-amber-800">步數</div>
            <div className="text-sm font-extrabold tabular-nums">{steps}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-center">
            <div className="text-[9px] font-bold text-emerald-800">最低</div>
            <div className="text-sm font-extrabold tabular-nums">{optimal}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className="shrink-0 rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 active:scale-[0.98]"
        >
          規則
        </button>
      </div>

      <div className="relative order-1 flex min-h-0 min-w-0 flex-1 flex-col bg-gradient-to-b from-[#FDFBF7] to-white p-1.5 sm:p-4 lg:order-1 lg:rounded-l-2xl lg:p-5">
        <button
          type="button"
          onClick={reset}
          className="absolute right-2 top-2 z-20 rounded-xl border-2 border-gray-300 bg-white/95 px-3 py-2 text-xs font-bold text-gray-800 shadow-sm hover:bg-gray-50 sm:right-3 sm:top-3 sm:px-4 sm:text-sm"
        >
          重來
        </button>
        <div className="grid min-h-[42vh] flex-1 grid-cols-3 gap-1.5 pt-10 sm:min-h-[min(52vh,420px)] sm:gap-3 sm:pt-11 lg:min-h-[320px] lg:gap-5 lg:pt-5">
          {([0, 1, 2] as const).map((i) => {
            const stack = rods[i];
            const top = stack[stack.length - 1];
            const isPickable = !done && !picked && top !== undefined;
            const isTarget = !!picked;
            const label = i === 0 ? '左' : i === 1 ? '中' : '右';
            return (
              <button
                key={i}
                type="button"
                onClick={() => tryPickOrDrop(i)}
                className={`relative flex min-h-[120px] flex-col rounded-xl border-2 p-1.5 text-left shadow-sm transition sm:min-h-[200px] sm:rounded-2xl sm:p-3 lg:min-h-0 ${isPickable ? 'border-amber-400 bg-white ring-2 ring-amber-100 hover:border-amber-500' : isTarget ? 'border-sky-200 bg-white hover:border-sky-300' : 'border-gray-200/90 bg-white'}`}
                aria-label={`柱子${label}`}
              >
                <div className="relative z-10 flex shrink-0 items-center justify-between gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 sm:text-xs">柱 {label}</span>
                  {picked?.from === i && (
                    <span className="rounded-full bg-amber-500 px-1 py-0.5 text-[9px] font-bold text-white sm:px-2 sm:text-xs">已拿起</span>
                  )}
                </div>
                <div className="pointer-events-none absolute bottom-[12%] left-1/2 top-[16%] w-1.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-gray-400 to-gray-300 sm:bottom-[14%] sm:top-[18%] sm:w-2.5" />
                <div className="pointer-events-none absolute bottom-[8%] left-1/2 h-2.5 w-[88%] -translate-x-1/2 rounded-md bg-gray-400/90 sm:bottom-[10%] sm:h-3 lg:h-4" />
                <div
                  className={`absolute bottom-[12%] left-1 right-1 top-[20%] flex flex-col-reverse items-center justify-start sm:left-2 sm:right-2 sm:bottom-[14%] sm:top-[22%] ${discGapClass}`}
                >
                  {stack.map((disc) => {
                    const pickedHere = picked && picked.from === i && picked.disc === disc && disc === top;
                    const widthPct = 38 + ((disc - 1) / Math.max(1, n - 1)) * 52;
                    return (
                      <div
                        key={disc}
                        className={`max-w-full shrink-0 rounded-lg border border-black/10 shadow-md transition sm:rounded-xl ${discHClass} ${pickedHere ? '-translate-y-1 ring-2 ring-amber-300 sm:-translate-y-2 sm:ring-4 lg:-translate-y-3' : ''}`}
                        style={{ width: `${widthPct}%`, background: discColor(disc, n) }}
                        title={`盤子 ${disc}`}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="order-2 hidden w-[min(18rem,28vw)] max-w-xs shrink-0 flex-col gap-3 border-gray-100 bg-gradient-to-b from-white to-[#FDFBF7] lg:flex lg:self-stretch lg:border-l lg:rounded-r-2xl lg:p-5">
        <div className="rounded-2xl border border-gray-200/80 bg-white/95 p-4 shadow-sm backdrop-blur-sm">{rulesCardInner}</div>
      </aside>

      {helpOpen && (
        <div
          className="fixed inset-0 z-[46] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setHelpOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="hanoi-help-title"
          >
            <h3 id="hanoi-help-title" className="text-lg font-extrabold text-amber-700">老師的小提示</h3>
            <p className="mt-4 text-sm leading-relaxed text-gray-700">{helpHint}</p>
            <button
              type="button"
              className="mt-6 w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-white hover:bg-amber-600"
              onClick={() => setHelpOpen(false)}
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {rulesOpen && (
        <div
          className="fixed inset-0 z-[45] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4 lg:hidden"
          onClick={() => setRulesOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="hanoi-rules-title"
          >
            <div className="mb-3 flex items-center justify-between">
              <span id="hanoi-rules-title" className="text-lg font-extrabold text-gray-900">遊戲說明</span>
              <button type="button" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100" onClick={() => setRulesOpen(false)}>關閉</button>
            </div>
            {rulesCardInner}
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="rounded-full bg-gray-900/90 px-4 py-2 text-sm font-semibold text-white shadow-lg">{toast}</div>
        </div>
      )}

      {done && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="text-2xl font-extrabold text-amber-600">過關！</div>
            <div className="mt-2 text-sm text-gray-700">你的步數：<span className="font-bold">{steps}</span></div>
            <div className="text-sm text-gray-700">最低步數：<span className="font-bold">{optimalSteps(n)}</span></div>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={reset} className="flex-1 rounded-xl border-2 border-gray-200 bg-gray-50 py-2.5 text-sm font-bold">再玩一次</button>
              <button type="button" onClick={onExit} className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white">返回</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

HanoiGame.displayName = 'HanoiGame';

function Click1Game({
  sendLog,
  onSuccess,
}: {
  sendLog: (action: string, opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }) => Promise<void>;
  onSuccess: () => void;
}) {
  const [done, setDone] = useState(false);

  const handleClick = () => {
    if (done) return;
    sendLog('CLICK', { payload: { button: 'center', count: 1 } });
    sendLog('SUCCESS', { isCorrect: true, payload: { button: 'center' } });
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <p className="text-2xl font-bold text-amber-600">過關！</p>
        <p className="text-sm text-gray-600">請點擊左下角「返回」離開</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-2xl bg-amber-500 px-12 py-8 text-xl font-bold text-white shadow-lg hover:bg-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-300"
      >
        點我 1 次
      </button>
    </div>
  );
}

function Click2Game({
  sendLog,
  onSuccess,
}: {
  sendLog: (action: string, opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }) => Promise<void>;
  onSuccess: () => void;
}) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setCount(0);
  };

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const handleClick = () => {
    if (done) return;
    if (count === 0) {
      setCount(1);
      sendLog('CLICK', { payload: { button: 'center', count: 1 } });
      timeoutRef.current = setTimeout(() => {
        sendLog('ERROR', { isCorrect: false, payload: { reason: 'timeout_3s' } });
        reset();
      }, 3000);
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    sendLog('CLICK', { payload: { button: 'center', count: 2 } });
    sendLog('SUCCESS', { isCorrect: true, payload: { button: 'center', clicks: 2 } });
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <p className="text-2xl font-bold text-amber-600">過關！</p>
        <p className="text-sm text-gray-600">請點擊左下角「返回」離開</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-2xl bg-amber-500 px-12 py-8 text-xl font-bold text-white shadow-lg hover:bg-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-300"
      >
        連續點我 2 次
      </button>
      {count === 1 && <p className="mt-4 text-sm text-gray-500">再點 1 次（3 秒內）</p>}
    </div>
  );
}

export { HanoiGame, Click1Game, Click2Game };
