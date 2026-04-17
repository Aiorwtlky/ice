'use client';

import { useMemo, useState } from 'react';

interface Props {
  previewMode?: boolean;
  onComplete?: (payload: { clearedCases: number; totalActions: number; mistakes: number; durationMs: number }) => void;
}

type ColorType = '藍色' | '綠色' | '紅色' | '黃色';
type ParityType = '奇數' | '偶數';
type Phase = 'idle' | 'hunt' | 'cleared' | 'done';

interface RecordItem {
  id: string;
  name: string;
  color: ColorType;
  height: number;
  seat: number;
}

interface DetectiveCase {
  records: RecordItem[];
  targetId: string;
  colorClue: ColorType;
  parityClue: ParityType;
  heightClue: number;
}

const COLORS: ColorType[] = ['藍色', '綠色', '紅色', '黃色'];
const FAMILY_NAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '邱', '曾', '廖'];
const GIVEN_NAMES = [
  '家豪',
  '怡君',
  '子晴',
  '承翰',
  '品妤',
  '宇辰',
  '思妤',
  '冠宇',
  '沛恩',
  '語彤',
  '柏翰',
  '書妍',
  '宥翔',
  '欣妤',
  '昱廷',
  '庭瑄',
  '哲宇',
  '宥妍',
  '品潔',
  '宸希',
];

function randomFrom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]) {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function createPeople(count: number) {
  const seats = shuffle(Array.from({ length: 45 }, (_, i) => i + 1)).slice(0, count);
  const used = new Set<string>();
  const records: RecordItem[] = Array.from({ length: count }, (_, i) => {
    let name = '';
    for (let t = 0; t < 30; t += 1) {
      name = `${randomFrom(FAMILY_NAMES)}${randomFrom(GIVEN_NAMES)}`;
      if (!used.has(name)) break;
    }
    used.add(name);
    return {
      id: `R-${i + 1}`,
      name,
      color: randomFrom(COLORS),
      height: 125 + Math.floor(Math.random() * 31),
      seat: seats[i],
    };
  });
  return shuffle(records);
}

function createCase(): DetectiveCase {
  const records = createPeople(40);
  const target = randomFrom(records);
  const colorClue = target.color;
  const parityClue: ParityType = target.seat % 2 === 0 ? '偶數' : '奇數';
  const heightClue = target.height;
  return { records, targetId: target.id, colorClue, parityClue, heightClue };
}

function createCases(count = 5) {
  return Array.from({ length: count }, () => createCase());
}

export default function AlgoLabDataDetectiveGame({ previewMode = false, onComplete }: Props) {
  const [cases, setCases] = useState<DetectiveCase[]>(() => createCases(5));
  const [caseIndex, setCaseIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [mistakes, setMistakes] = useState(0);
  const [actions, setActions] = useState(0);
  const [message, setMessage] = useState('本實驗不提供篩選與排序，先按「開始」再依線索在大清單中找人。');
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const currentCase = cases[caseIndex];

  const records = useMemo(() => currentCase.records, [currentCase.records]);

  const targetRecord = currentCase.records.find((r) => r.id === currentCase.targetId);

  const startCase = () => {
    if (phase !== 'idle') return;
    const now = Date.now();
    if (!startedAt) setStartedAt(now);
    setActions((v) => v + 1);
    setPhase('hunt');
    setMessage('開始！請依線索在清單中找出正確的那一位。');
  };

  const pickRecord = (id: string) => {
    if (phase !== 'hunt') return;
    setActions((v) => v + 1);
    if (id !== currentCase.targetId) {
      setMistakes((v) => v + 1);
      setMessage('這位不是正確對象，請再依線索檢查顏色／座號奇偶／身高。');
      return;
    }
    if (caseIndex >= cases.length - 1) {
      setPhase('done');
      setMessage('全部案件完成，做得很好！');
      if (!previewMode) {
        const durationMs = startedAt ? Date.now() - startedAt : 0;
        onComplete?.({
          clearedCases: cases.length,
          totalActions: actions + 1,
          mistakes,
          durationMs,
        });
      }
      return;
    }
    setPhase('cleared');
    setMessage('案件完成！你可以進入下一案。');
  };

  const goNextCase = () => {
    if (phase !== 'cleared') return;
    setCaseIndex((v) => v + 1);
    setPhase('idle');
    setMessage('新案件準備好了：按「開始」後才會顯示線索與名單。');
  };

  const resetAll = () => {
    setCases(createCases(5));
    setCaseIndex(0);
    setPhase('idle');
    setMistakes(0);
    setActions(0);
    setStartedAt(null);
    setMessage('已重置所有案件，按「開始」後才會顯示線索與名單。');
  };

  const isFinalDone = phase === 'done';

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 overflow-y-auto p-2 sm:p-4 lg:grid lg:grid-cols-[1.45fr_1fr]">
      <section className="flex min-h-0 flex-col rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h2 className="text-lg font-black text-gray-900 sm:text-2xl">實驗四：綜合任務・資料偵探</h2>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">
          連續 5 個案件。這個版本 <span className="font-black">不提供篩選與排序</span>，讓你體驗「沒整理資料會有多慘」。
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-sky-50 px-3 py-2">
            <p className="text-[11px] text-sky-700 sm:text-xs">案件進度</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{caseIndex + 1} / {cases.length}</p>
          </div>
          <div className="rounded-xl bg-indigo-50 px-3 py-2">
            <p className="text-[11px] text-indigo-700 sm:text-xs">候選人數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{records.length}</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700 sm:text-xs">操作次數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{actions}</p>
          </div>
          <div className="rounded-xl bg-rose-50 px-3 py-2">
            <p className="text-[11px] text-rose-700 sm:text-xs">失誤次數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{mistakes}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startCase}
            disabled={phase !== 'idle'}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50 sm:flex-none"
          >
            開始
          </button>
          <button
            type="button"
            onClick={goNextCase}
            disabled={phase !== 'cleared'}
            className="flex-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50 sm:flex-none"
          >
            下一案件
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 sm:w-auto"
          >
            全部重置
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 sm:text-base">
          {phase === 'idle' ? (
            '線索與名單尚未顯示。按「開始」後才會出現。'
          ) : (
            <>
              線索：{currentCase.colorClue}衣服、座號{currentCase.parityClue}、身高 {currentCase.heightClue} cm
            </>
          )}
        </div>

        <div className="mt-3 grid max-h-[52vh] grid-cols-1 gap-2 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-2 sm:max-h-[420px] sm:grid-cols-3">
          {records.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => pickRecord(record.id)}
              disabled={phase !== 'hunt'}
              className={`rounded-xl border bg-white px-2 py-2 text-left text-xs text-gray-700 transition sm:text-sm ${
                phase === 'hunt'
                  ? 'border-amber-200 hover:border-amber-400 hover:bg-amber-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="font-bold text-gray-900">{record.name}</div>
              <div>{record.color} · {record.height} cm</div>
              <div>座號 {record.seat}</div>
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-900 sm:text-base">
          {message}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:min-h-0 lg:overflow-y-auto lg:rounded-3xl lg:p-6">
        <h3 className="text-base font-black text-gray-900 sm:text-lg">老師的話</h3>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">
          你正在做的不是猜答案，而是設計流程：先縮小範圍，再排序定位，最後精準命中。
        </p>
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 sm:text-sm">
          目標：體驗「資料不整理」的痛苦，並用更少操作完成 5 個案件。
        </div>
        {targetRecord && (phase === 'cleared' || phase === 'done') && (
          <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900 sm:text-sm">
            本案正解：{targetRecord.name}（{targetRecord.color}，{targetRecord.height}cm，座號 {targetRecord.seat}）
          </div>
        )}
      </aside>
    </div>
  );
}
