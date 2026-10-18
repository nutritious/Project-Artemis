export interface LogEntry {
  ts: number;
  user: string;
  method: string;
  host: string;
  path: string;
  status: number;
  bytes: number;
  ms: number;
}

const MAX_LOGS = 600;
const logs: LogEntry[] = [];
const reqPerMin = new Map<number, number>();
const bytesPerMin = new Map<number, number>();
const errPerMin = new Map<number, number>();
const hostCounts = new Map<string, { n: number; bytes: number }>();
const statusCounts = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
const startedAt = Date.now();
let totalRequests = 0;
let totalBytes = 0;
const lastSeen = new Map<string, number>();

export function record(e: LogEntry) {
  logs.push(e);
  if (logs.length > MAX_LOGS) logs.shift();
  totalRequests++;
  totalBytes += e.bytes;
  lastSeen.set(e.user, e.ts);
  const minute = Math.floor(e.ts / 60_000);
  reqPerMin.set(minute, (reqPerMin.get(minute) ?? 0) + 1);
  bytesPerMin.set(minute, (bytesPerMin.get(minute) ?? 0) + e.bytes);
  if (e.status >= 400) errPerMin.set(minute, (errPerMin.get(minute) ?? 0) + 1);
  for (const m of [reqPerMin, bytesPerMin, errPerMin]) for (const k of m.keys()) if (k < minute - 90) m.delete(k);
  const bucket = e.status >= 500 ? "5xx" : e.status >= 400 ? "4xx" : e.status >= 300 ? "3xx" : "2xx";
  statusCounts[bucket]++;
  const h = hostCounts.get(e.host) ?? { n: 0, bytes: 0 };
  h.n++;
  h.bytes += e.bytes;
  hostCounts.set(e.host, h);
  if (hostCounts.size > 800) {
    const smallest = [...hostCounts.entries()].sort((a, b) => a[1].n - b[1].n).slice(0, 200);
    for (const [k] of smallest) hostCounts.delete(k);
  }
}

const series = (m: Map<number, number>, n = 60) => {
  const nowMin = Math.floor(Date.now() / 60_000);
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(m.get(nowMin - i) ?? 0);
  return out;
};

export function snapshot(withLogs = true) {
  const active = [...lastSeen.values()].filter((t) => Date.now() - t < 5 * 60_000).length;
  const req = series(reqPerMin);
  const err = series(errPerMin);
  const recentReq = req.slice(-5).reduce((a, b) => a + b, 0);
  const recentErr = err.slice(-5).reduce((a, b) => a + b, 0);
  return {
    now: Date.now(),
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    totalRequests,
    totalBytes,
    activeUsers: active,
    perMinuteNow: req[req.length - 1] ?? 0,
    errorRate: recentReq ? recentErr / recentReq : 0,
    series: { req, bytes: series(bytesPerMin), err },
    status: { ...statusCounts },
    topHosts: [...hostCounts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([host, v]) => ({ host, n: v.n, bytes: v.bytes })),
    logs: withLogs ? logs.slice(-200).reverse() : [],
  };
}
