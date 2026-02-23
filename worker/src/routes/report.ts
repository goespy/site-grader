import type { Env } from '../index';

export async function handleReport(id: string, env: Env): Promise<Response> {
  // 1. Validate id format (UUID prefix: hex + hyphens, 11-12 chars)
  if (!id || !/^[a-f0-9-]{8,12}$/.test(id)) {
    return Response.json(
      { error: 'Invalid report ID.' },
      { status: 400 },
    );
  }

  // 2. Fetch from KV
  const data = await env.REPORTS.get('report:' + id);

  if (data === null) {
    return Response.json(
      { error: 'Report not found.' },
      { status: 404 },
    );
  }

  // 3. Return parsed report
  return Response.json(JSON.parse(data));
}
