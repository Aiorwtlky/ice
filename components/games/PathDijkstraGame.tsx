'use client';

import { useMemo, useState } from 'react';

interface Props {
  guideEnabled?: boolean;
  previewMode?: boolean;
  onComplete?: (payload: { correctSteps: number; wrongChoices: number; durationMs: number }) => void;
}

type NodeId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

const NODES: NodeId[] = ['A', 'B', 'C', 'D', 'E', 'F'];
const TARGET: NodeId = 'F';

const EDGES: Record<NodeId, { to: NodeId; w: number }[]> = {
  A: [
    { to: 'B', w: 4 },
    { to: 'C', w: 2 },
  ],
  B: [
    { to: 'A', w: 4 },
    { to: 'C', w: 1 },
    { to: 'D', w: 5 },
  ],
  C: [
    { to: 'A', w: 2 },
    { to: 'B', w: 1 },
    { to: 'D', w: 8 },
    { to: 'E', w: 10 },
  ],
  D: [
    { to: 'B', w: 5 },
    { to: 'C', w: 8 },
    { to: 'E', w: 2 },
    { to: 'F', w: 6 },
  ],
  E: [
    { to: 'C', w: 10 },
    { to: 'D', w: 2 },
    { to: 'F', w: 2 },
  ],
  F: [
    { to: 'D', w: 6 },
    { to: 'E', w: 2 },
  ],
};

const INF = 1_000_000_000;

function initialDist() {
  return {
    A: 0,
    B: INF,
    C: INF,
    D: INF,
    E: INF,
    F: INF,
  } as Record<NodeId, number>;
}

export default function PathDijkstraGame({ guideEnabled = false, previewMode = false, onComplete }: Props) {
  const [dist, setDist] = useState<Record<NodeId, number>>(() => initialDist());
  const [visited, setVisited] = useState<Record<NodeId, boolean>>({
    A: false,
    B: false,
    C: false,
    D: false,
    E: false,
    F: false,
  });
  const [steps, setSteps] = useState(0);
  const [wrongChoices, setWrongChoices] = useState(0);
  const [message, setMessage] = useState('從 A 出發，依序選「目前距離最小」的未確定節點。');
  const [done, setDone] = useState(false);

  const suggestedNode = useMemo(() => {
    let best: NodeId | null = null;
    let bestDist = INF;
    for (const node of NODES) {
      if (visited[node]) continue;
      if (dist[node] < bestDist) {
        best = node;
        bestDist = dist[node];
      }
    }
    return best;
  }, [dist, visited]);

  const pickNode = (node: NodeId) => {
    if (done || visited[node] || suggestedNode === null) return;

    if (node !== suggestedNode) {
      setWrongChoices((w) => w + 1);
      setMessage(`這步不對。應該先選距離最小的節點（目前是 ${suggestedNode}）。`);
      return;
    }

    const nextDist = { ...dist };
    for (const edge of EDGES[node]) {
      if (visited[edge.to]) continue;
      const cand = nextDist[node] + edge.w;
      if (cand < nextDist[edge.to]) nextDist[edge.to] = cand;
    }
    const nextVisited = { ...visited, [node]: true };
    const nextSteps = steps + 1;

    setDist(nextDist);
    setVisited(nextVisited);
    setSteps(nextSteps);
    setMessage(`已確定 ${node}。請繼續選下一個最短節點。`);

    if (node === TARGET) {
      setDone(true);
      setMessage(`完成！A 到 F 最短距離是 ${nextDist[TARGET]}。`);
      if (!previewMode) {
        onComplete?.({ correctSteps: nextSteps, wrongChoices, durationMs: 0 });
      }
    }
  };

  const reset = () => {
    setDist(initialDist());
    setVisited({
      A: false,
      B: false,
      C: false,
      D: false,
      E: false,
      F: false,
    });
    setSteps(0);
    setWrongChoices(0);
    setMessage('已重置，從 A 出發。');
    setDone(false);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 p-2 sm:p-4 lg:grid lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h2 className="text-xl font-black text-gray-900 sm:text-2xl">最短路徑挑戰（Dijkstra）</h2>
        <p className="mt-2 text-sm text-gray-600">
          從 <span className="font-bold text-amber-700">A</span> 走到{' '}
          <span className="font-bold text-amber-700">F</span>，每步要選「目前距離最小」的未確定節點。
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {NODES.map((node) => (
            <button
              key={node}
              type="button"
              disabled={done || visited[node]}
              onClick={() => pickNode(node)}
              className={`rounded-xl border px-3 py-3 text-left ${
                visited[node] ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
              } disabled:opacity-80`}
            >
              <p className="text-xs text-gray-500">節點 {node}</p>
              <p className="text-lg font-black text-gray-900">{dist[node] >= INF ? '∞' : dist[node]}</p>
              <p className="text-xs text-gray-500">{visited[node] ? '已確定' : '未確定'}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700"
          >
            重新開始
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {message}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h3 className="text-base font-black text-gray-900 sm:text-lg">學習指標</h3>
        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <p>正確步數：<span className="font-bold">{steps}</span></p>
          <p>錯誤選擇：<span className="font-bold">{wrongChoices}</span></p>
          <p>目標距離：<span className="font-bold">{dist[TARGET] >= INF ? '未確定' : dist[TARGET]}</span></p>
        </div>

        {guideEnabled ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            提示：下一個應選 {suggestedNode ?? '（已完成）'}。
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
            無提示模式：請自己判斷目前最小距離節點。
          </div>
        )}
      </aside>
    </div>
  );
}
