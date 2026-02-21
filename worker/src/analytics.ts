import type { Env } from './index';

const STATS_KEY = 'analytics:stats';

export interface AnalyticsStats {
  scans: {
    total: number;
    byType: Record<string, number>;
    byGrade: Record<string, number>;
    byAdSpend: Record<string, number>;
  };
  leads: {
    total: number;
    byType: Record<string, number>;
    byGrade: Record<string, number>;
  };
  lastUpdated: string;
}

function emptyStats(): AnalyticsStats {
  return {
    scans: { total: 0, byType: {}, byGrade: {}, byAdSpend: {} },
    leads: { total: 0, byType: {}, byGrade: {} },
    lastUpdated: new Date().toISOString(),
  };
}

function inc(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export async function getStats(env: Env): Promise<AnalyticsStats> {
  const raw = await env.REPORTS.get(STATS_KEY);
  return raw ? JSON.parse(raw) : emptyStats();
}

export async function recordScan(
  env: Env,
  businessType: string,
  grade: string,
  adSpend: string | null,
): Promise<void> {
  const stats = await getStats(env);
  stats.scans.total++;
  inc(stats.scans.byType, businessType);
  inc(stats.scans.byGrade, grade.charAt(0)); // bucket by letter: A, B, C, D, F
  inc(stats.scans.byAdSpend, adSpend ?? 'none');
  stats.lastUpdated = new Date().toISOString();
  await env.REPORTS.put(STATS_KEY, JSON.stringify(stats));
}

export async function recordLead(
  env: Env,
  businessType: string,
  grade: string,
): Promise<void> {
  const stats = await getStats(env);
  stats.leads.total++;
  inc(stats.leads.byType, businessType);
  inc(stats.leads.byGrade, grade.charAt(0));
  stats.lastUpdated = new Date().toISOString();
  await env.REPORTS.put(STATS_KEY, JSON.stringify(stats));
}
