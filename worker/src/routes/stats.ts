import type { Env } from '../index';
import { getStats } from '../analytics';

export async function handleStats(request: Request, env: Env): Promise<Response> {
  // Auth check
  const auth = request.headers.get('Authorization');
  if (!env.STATS_TOKEN || auth !== `Bearer ${env.STATS_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await getStats(env);

  // Compute conversion rates
  const overallConversion = stats.scans.total > 0
    ? stats.leads.total / stats.scans.total
    : 0;

  const conversionByType: Record<string, number> = {};
  for (const type of Object.keys(stats.scans.byType)) {
    const scans = stats.scans.byType[type] ?? 0;
    const leads = stats.leads.byType[type] ?? 0;
    conversionByType[type] = scans > 0 ? leads / scans : 0;
  }

  return Response.json({
    ...stats,
    conversion: {
      overall: overallConversion,
      byType: conversionByType,
    },
  });
}
