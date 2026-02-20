import type { Env } from '../index';

export async function handleReport(id: string, env: Env): Promise<Response> {
  // 1. Validate id
  if (!id || id.length < 8) {
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
