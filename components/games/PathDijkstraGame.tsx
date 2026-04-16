'use client';

import { useMemo, useState } from 'react';

interface Props {
  guideEnabled?: boolean;
  previewMode?: boolean;
  onComplete?: (payload: { correctSteps: number; wrongChoices: number; durationMs: number }) => void;
}

type NodeId = string;

interface Puzzle {
  id: string;
  start: NodeId;
  target: NodeId;
  edges: Array<{ a: NodeId; b: NodeId; w: number }>;
  positions: Record<NodeId, { x: number; y: number }>;
}

const NODES: NodeId[] = Array.from({ length: 15 }, (_, i) => `N${i + 1}`);
const INF = 1_000_000_000;

const PUZZLES: Puzzle[] = [
  {
    id: 'P15-A',
    start: 'N1',
    target: 'N15',
    edges: [
      { a: 'N1', b: 'N4', w: 2 },
      { a: 'N1', b: 'N5', w: 3 },
      { a: 'N2', b: 'N5', w: 2 },
      { a: 'N2', b: 'N6', w: 4 },
      { a: 'N3', b: 'N6', w: 2 },
      { a: 'N4', b: 'N7', w: 3 },
      { a: 'N4', b: 'N8', w: 5 },
      { a: 'N5', b: 'N8', w: 2 },
      { a: 'N5', b: 'N9', w: 4 },
      { a: 'N6', b: 'N9', w: 3 },
      { a: 'N7', b: 'N10', w: 2 },
      { a: 'N7', b: 'N11', w: 4 },
      { a: 'N8', b: 'N11', w: 2 },
      { a: 'N8', b: 'N12', w: 3 },
      { a: 'N9', b: 'N12', w: 2 },
      { a: 'N10', b: 'N13', w: 2 },
      { a: 'N10', b: 'N14', w: 4 },
      { a: 'N11', b: 'N14', w: 2 },
      { a: 'N11', b: 'N15', w: 5 },
      { a: 'N12', b: 'N15', w: 2 },
    ],
    positions: {
      N1: { x: 9, y: 20 },
      N2: { x: 16, y: 46 },
      N3: { x: 11, y: 60 },
      N4: { x: 30, y: 18 },
      N5: { x: 31, y: 43 },
      N6: { x: 27, y: 68 },
      N7: { x: 47, y: 23 },
      N8: { x: 49, y: 44 },
      N9: { x: 45, y: 66 },
      N10: { x: 63, y: 26 },
      N11: { x: 65, y: 46 },
      N12: { x: 62, y: 69 },
      N13: { x: 82, y: 24 },
      N14: { x: 81, y: 47 },
      N15: { x: 86, y: 67 },
    },
  },
  {
    id: 'P15-B',
    start: 'N2',
    target: 'N14',
    edges: [
      { a: 'N1', b: 'N4', w: 4 },
      { a: 'N2', b: 'N4', w: 2 },
      { a: 'N2', b: 'N5', w: 2 },
      { a: 'N3', b: 'N5', w: 3 },
      { a: 'N3', b: 'N6', w: 2 },
      { a: 'N4', b: 'N7', w: 3 },
      { a: 'N5', b: 'N7', w: 4 },
      { a: 'N5', b: 'N8', w: 2 },
      { a: 'N6', b: 'N8', w: 3 },
      { a: 'N6', b: 'N9', w: 2 },
      { a: 'N7', b: 'N10', w: 2 },
      { a: 'N8', b: 'N10', w: 4 },
      { a: 'N8', b: 'N11', w: 2 },
      { a: 'N9', b: 'N11', w: 3 },
      { a: 'N9', b: 'N12', w: 2 },
      { a: 'N10', b: 'N13', w: 2 },
      { a: 'N11', b: 'N13', w: 3 },
      { a: 'N11', b: 'N14', w: 2 },
      { a: 'N12', b: 'N14', w: 3 },
      { a: 'N12', b: 'N15', w: 2 },
    ],
    positions: {
      N1: { x: 10, y: 16 },
      N2: { x: 15, y: 28 },
      N3: { x: 12, y: 52 },
      N4: { x: 34, y: 15 },
      N5: { x: 30, y: 37 },
      N6: { x: 33, y: 62 },
      N7: { x: 50, y: 20 },
      N8: { x: 47, y: 41 },
      N9: { x: 50, y: 64 },
      N10: { x: 67, y: 25 },
      N11: { x: 66, y: 46 },
      N12: { x: 69, y: 67 },
      N13: { x: 84, y: 30 },
      N14: { x: 82, y: 50 },
      N15: { x: 88, y: 68 },
    },
  },
];

function buildAdjacency(edges: Array<{ a: NodeId; b: NodeId; w: number }>) {
  const acc = Object.fromEntries(NODES.map((node) => [node, [] as { to: NodeId; w: number }[]])) as Record<
    NodeId,
    { to: NodeId; w: number }[]
  >;
  for (const edge of edges) {
    acc[edge.a].push({ to: edge.b, w: edge.w });
    acc[edge.b].push({ to: edge.a, w: edge.w });
  }
  return acc;
}

function buildDist(start: NodeId) {
  const result = Object.fromEntries(NODES.map((node) => [node, INF])) as Record<NodeId, number>;
  result[start] = 0;
  return result;
}

function buildVisited(start: NodeId) {
  const visited = Object.fromEntries(NODES.map((node) => [node, false])) as Record<NodeId, boolean>;
  visited[start] = true;
  return visited;
}

function buildParent() {
  return Object.fromEntries(NODES.map((node) => [node, null])) as Record<NodeId, NodeId | null>;
}

function buildInitialState(puzzle: Puzzle) {
  const dist = buildDist(puzzle.start);
  const parent = buildParent();
  for (const edge of puzzle.edges) {
    if (edge.a === puzzle.start && edge.w < dist[edge.b]) {
      dist[edge.b] = edge.w;
      parent[edge.b] = puzzle.start;
    } else if (edge.b === puzzle.start && edge.w < dist[edge.a]) {
      dist[edge.a] = edge.w;
      parent[edge.a] = puzzle.start;
    }
  }
  return { dist, parent };
}

function nextPuzzleIndex(current: number) {
  if (PUZZLES.length <= 1) return 0;
  const candidates = PUZZLES.map((_, idx) => idx).filter((idx) => idx !== current);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function edgeKey(a: NodeId, b: NodeId) {
  return [a, b].sort().join('-');
}

function displayNode(node: NodeId) {
  return node.replace('N', '');
}

export default function PathDijkstraGame({ guideEnabled = false, previewMode = false, onComplete }: Props) {
  const [puzzleIndex, setPuzzleIndex] = useState(() => Math.floor(Math.random() * PUZZLES.length));
  const puzzle = PUZZLES[puzzleIndex];
  const adjacency = useMemo(() => buildAdjacency(puzzle.edges), [puzzle]);
  const initialState = useMemo(() => buildInitialState(puzzle), [puzzle]);

  const [dist, setDist] = useState<Record<NodeId, number>>(() => initialState.dist);
  const [visited, setVisited] = useState<Record<NodeId, boolean>>(() => buildVisited(puzzle.start));
  const [parent, setParent] = useState<Record<NodeId, NodeId | null>>(() => initialState.parent);
  const [steps, setSteps] = useState(0);
  const [wrongChoices, setWrongChoices] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('任務開始：起點已亮起，請點選正確路徑擴展最短路徑樹。');
  const [logs, setLogs] = useState<string[]>([]);
  const [wrongSelectedEdges, setWrongSelectedEdges] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

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

  const frontierMinDist = useMemo(() => {
    let bestDist = INF;
    for (const node of NODES) {
      if (visited[node]) continue;
      if (dist[node] < bestDist) bestDist = dist[node];
    }
    return bestDist;
  }, [dist, visited]);

  const activeTreeEdges = useMemo(() => {
    const keys = new Set<string>();
    for (const node of NODES) {
      const p = parent[node];
      if (p && visited[node]) keys.add(edgeKey(node, p));
    }
    return keys;
  }, [parent, visited]);

  const visitedCount = useMemo(() => NODES.filter((n) => visited[n]).length, [visited]);

  const appendLog = (text: string) => {
    setLogs((prev) => [text, ...prev].slice(0, 8));
  };

  const settleNodeFromEdge = (toNode: NodeId, fromNode: NodeId, now: number) => {
    const nextDist = { ...dist };
    const nextParent = { ...parent };
    const relaxEvents: string[] = [];

    for (const edge of adjacency[toNode]) {
      const cand = nextDist[toNode] + edge.w;
      if (cand < nextDist[edge.to]) {
        nextDist[edge.to] = cand;
        nextParent[edge.to] = toNode;
        relaxEvents.push(`${displayNode(toNode)} → ${displayNode(edge.to)} 更新為 ${cand}`);
      }
    }

    nextParent[toNode] = fromNode;
    const nextVisited = { ...visited, [toNode]: true };
    const nextSteps = steps + 1;

    setDist(nextDist);
    setParent(nextParent);
    setVisited(nextVisited);
    setSteps(nextSteps);
    setScore((s) => s + 10 + Math.min(relaxEvents.length, 3));

    if (relaxEvents.length > 0) {
      setMessage(`已確定節點 ${displayNode(toNode)}，並更新 ${relaxEvents.length} 個鄰點距離。`);
      appendLog(`確定 ${displayNode(toNode)}：${relaxEvents.join('、')}`);
    } else {
      setMessage(`已確定節點 ${displayNode(toNode)}，本步沒有更短距離被更新。`);
      appendLog(`確定 ${displayNode(toNode)}：無更新`);
    }

    const reachedTarget = nextVisited[puzzle.target];
    const hasFrontier = NODES.some((node) => !nextVisited[node] && nextDist[node] < INF);

    if (reachedTarget && hasFrontier) {
      setMessage(
        `已到達目標 ${displayNode(puzzle.target)}（距離 ${nextDist[puzzle.target]}）。你可繼續擴展其他節點。`
      );
      appendLog(`已抵達目標 ${displayNode(puzzle.target)}，可繼續探索剩餘節點`);
    }

    if (!hasFrontier) {
      setDone(true);
      const durationMs = startedAt ? now - startedAt : 0;
      setMessage(
        `探索完成！起點 ${displayNode(puzzle.start)} 到目標 ${displayNode(puzzle.target)} 最短距離是 ${nextDist[puzzle.target]}。`
      );
      appendLog(`探索完成：目標最短距離 ${nextDist[puzzle.target]}，總步數 ${nextSteps}`);
      if (!previewMode) onComplete?.({ correctSteps: nextSteps, wrongChoices, durationMs });
    }
  };

  const pickEdge = (edge: { a: NodeId; b: NodeId; w: number }) => {
    if (done) return;
    const key = edgeKey(edge.a, edge.b);
    const now = Date.now();
    if (!startedAt) setStartedAt(now);

    // 取消紅線標記要最高優先權，避免被後續條件攔截。
    if (wrongSelectedEdges.has(key)) {
      setWrongSelectedEdges((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setMessage(`已取消路徑 ${displayNode(edge.a)} - ${displayNode(edge.b)} 的錯誤標記。`);
      appendLog(`取消錯誤標記 ${displayNode(edge.a)}-${displayNode(edge.b)}`);
      return;
    }

    const aVisited = visited[edge.a];
    const bVisited = visited[edge.b];
    const touchesTree = (aVisited && !bVisited) || (!aVisited && bVisited);
    if (suggestedNode === null) {
      setMessage('目前沒有可擴展節點。若已完成可換題重玩。');
      return;
    }

    if (!touchesTree) {
      setMessage(`路徑 ${displayNode(edge.a)}-${displayNode(edge.b)} 目前不能選：必須一端已確定、另一端未確定。`);
      appendLog(`忽略 ${displayNode(edge.a)}-${displayNode(edge.b)}：不屬於目前擴展邊界`);
      return;
    }

    const candidateNode = aVisited ? edge.b : edge.a;
    const fromNode = aVisited ? edge.a : edge.b;
    const linkDistance = touchesTree ? dist[fromNode] + edge.w : INF;
    const isBestLink = touchesTree && linkDistance === dist[candidateNode];
    const isFrontierMin = touchesTree && dist[candidateNode] === frontierMinDist;
    const isCorrect = touchesTree && isFrontierMin && isBestLink;

    if (touchesTree && isFrontierMin && !isBestLink) {
      setWrongChoices((w) => w + 1);
      setScore((s) => Math.max(0, s - 5));
      setWrongSelectedEdges((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setMessage(
        guideEnabled
          ? `節點 ${displayNode(candidateNode)} 要先走更短路徑（目前最短 ${dist[candidateNode]}），這條邊成本是 ${linkDistance}。`
          : `這條邊不是目前最短連接方式，已標紅。你可以改選或再點一次取消標記。`
      );
      appendLog(
        guideEnabled
          ? `誤選 ${displayNode(fromNode)}-${displayNode(candidateNode)}：成本 ${linkDistance}，最短應為 ${dist[candidateNode]}`
          : `誤選路徑 ${displayNode(fromNode)}-${displayNode(candidateNode)}（非最短連接）`
      );
      return;
    }

    if (!isCorrect) {
      setWrongChoices((w) => w + 1);
      setScore((s) => Math.max(0, s - 5));
      setWrongSelectedEdges((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setMessage(
        guideEnabled
          ? `這條路不對，已標紅。當前應先連「暫定距離 ${frontierMinDist}」的節點。`
          : '這條路不對，已標紅。你可以改選或再點一次取消標記。'
      );
      appendLog(
        guideEnabled
          ? `誤選路徑 ${displayNode(edge.a)}-${displayNode(edge.b)}（應連到 ${displayNode(suggestedNode)}）`
          : `誤選路徑 ${displayNode(edge.a)}-${displayNode(edge.b)}`
      );
      return;
    }

    setWrongSelectedEdges((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    settleNodeFromEdge(candidateNode, fromNode, now);
  };

  const reset = () => {
    const nextIdx = nextPuzzleIndex(puzzleIndex);
    const nextPuzzle = PUZZLES[nextIdx];
    const nextInitialState = buildInitialState(nextPuzzle);
    setPuzzleIndex(nextIdx);
    setDist(nextInitialState.dist);
    setVisited(buildVisited(nextPuzzle.start));
    setParent(nextInitialState.parent);
    setSteps(0);
    setWrongChoices(0);
    setScore(0);
    setMessage(`已切換新題目（${nextPuzzle.id}），起點已亮起，請點正確路徑。`);
    setLogs([]);
    setWrongSelectedEdges(new Set());
    setDone(false);
    setStartedAt(null);
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 overflow-y-auto p-2 sm:p-4 lg:grid lg:grid-cols-[1.35fr_1fr]">
      <section className="flex min-h-0 flex-col rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h2 className="text-xl font-black text-gray-900 sm:text-2xl">最短路徑探險（Dijkstra Graph Quest）</h2>
        <p className="mt-2 text-sm text-gray-600">
          起點 <span className="font-bold text-amber-700">{displayNode(puzzle.start)}</span> 已亮起。請點「路徑」把新節點接進已探索區域，直到到達{' '}
          <span className="font-bold text-amber-700">{displayNode(puzzle.target)}</span>。
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-indigo-50 px-3 py-2">
            <p className="text-[11px] text-indigo-700 sm:text-xs">已確定節點</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{visitedCount} / {NODES.length}</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700 sm:text-xs">正確步數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{steps}</p>
          </div>
          <div className="rounded-xl bg-rose-50 px-3 py-2">
            <p className="text-[11px] text-rose-700 sm:text-xs">錯誤選擇</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{wrongChoices}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-[11px] text-emerald-700 sm:text-xs">探索分數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{score}</p>
          </div>
        </div>

        <div className="mt-3 h-[56vh] min-h-[360px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-b from-sky-50 to-white sm:h-[58vh] sm:min-h-[400px] lg:h-[56vh]">
          <div className="relative h-full w-full">
            <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              {puzzle.edges.map((edge) => {
                const from = puzzle.positions[edge.a];
                const to = puzzle.positions[edge.b];
                const key = edgeKey(edge.a, edge.b);
                const isInTree = activeTreeEdges.has(key);
                const isWrong = wrongSelectedEdges.has(key);
                const strokeColor = isWrong ? '#F43F5E' : isInTree ? '#10B981' : '#CBD5E1';
                const midX = (from.x + to.x) / 2;
                const midY = (from.y + to.y) / 2;
                return (
                  <g key={`${edge.a}-${edge.b}-${edge.w}`}>
                    <line
                      x1={`${from.x}%`}
                      y1={`${from.y}%`}
                      x2={`${to.x}%`}
                      y2={`${to.y}%`}
                      stroke={strokeColor}
                      strokeWidth={isInTree ? 2.8 : isWrong ? 2.5 : 1.8}
                    />
                    <line
                      x1={`${from.x}%`}
                      y1={`${from.y}%`}
                      x2={`${to.x}%`}
                      y2={`${to.y}%`}
                      stroke="transparent"
                      strokeWidth={18}
                      className="cursor-pointer"
                      onClick={() => pickEdge(edge)}
                    />
                    <text
                      x={`${midX}%`}
                      y={`${midY - 1.2}%`}
                      textAnchor="middle"
                      className="fill-gray-600 font-bold"
                      style={{ fontSize: '10px' }}
                    >
                      {edge.w}
                    </text>
                  </g>
                );
              })}
            </svg>

            {NODES.map((node) => {
              const pos = puzzle.positions[node];
              const isCurrentHint = guideEnabled && !done && suggestedNode === node;
              const isVisited = visited[node];
              return (
                <div
                  key={node}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                  className={`absolute flex h-11 w-11 flex-col items-center justify-center rounded-full border-2 text-[10px] font-black shadow-sm transition sm:h-14 sm:w-14 sm:text-[11px] ${
                    isVisited
                      ? 'border-emerald-400 bg-emerald-500 text-white'
                      : isCurrentHint
                        ? 'border-amber-400 bg-amber-100 text-amber-900'
                        : 'border-sky-300 bg-white text-sky-900'
                  }`}
                >
                  <span>{node.replace('N', '')}</span>
                  <span className="text-[10px]">{dist[node] >= INF ? '∞' : dist[node]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700"
          >
            換一題重玩
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">{message}</div>
      </section>

      <aside className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:min-h-0 lg:overflow-y-auto lg:rounded-3xl lg:p-6">
        <h3 className="text-base font-black text-gray-900 sm:text-lg">任務情報</h3>
        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <p>題號：<span className="font-bold">{puzzle.id}</span></p>
          <p>起點：<span className="font-bold">{displayNode(puzzle.start)}</span></p>
          <p>目標：<span className="font-bold">{displayNode(puzzle.target)}</span></p>
          <p>目前最短距離：<span className="font-bold">{dist[puzzle.target] >= INF ? '未確定' : dist[puzzle.target]}</span></p>
        </div>

        {guideEnabled ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            提示：下一個建議連到 <span className="font-black">{suggestedNode ? displayNode(suggestedNode) : '（已完成）'}</span>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
            無提示模式：系統不顯示建議節點，只能靠距離判斷。
          </div>
        )}

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="text-sm font-bold text-gray-900">探索紀錄</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-700 sm:text-sm">
            {logs.length === 0 && <li className="text-gray-500">尚無紀錄，開始點路徑吧。</li>}
            {logs.map((log, idx) => (
              <li key={`${log}-${idx}`}>{log}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
