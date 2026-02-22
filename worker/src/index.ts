import { handleScan } from './routes/scan';
import { handleReport } from './routes/report';
import { handleLead } from './routes/lead';
import { handleStats } from './routes/stats';

export interface Env {
  REPORTS: KVNamespace;
  PAGESPEED_API_KEY: string;
  RESEND_API_KEY: string;
  LEAD_EMAIL_TO: string;
  STATS_TOKEN: string;
  OPENROUTER_API_KEY: string;
  GOOGLE_PLACES_API_KEY?: string;
}

const ALLOWED_ORIGINS = [
  'https://site-grader.pages.dev',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
  'http://localhost:3000',
  'http://localhost:5000',
];

function corsHeaders(origin: string | null): HeadersInit {
  const resolvedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    let response: Response;

    try {
      if (url.pathname === '/api/scan' && request.method === 'POST') {
        response = await handleScan(request, env, ctx);
      } else if (url.pathname.startsWith('/api/report/') && request.method === 'GET') {
        const id = url.pathname.replace('/api/report/', '');
        response = await handleReport(id, env);
      } else if (url.pathname === '/api/lead' && request.method === 'POST') {
        response = await handleLead(request, env, ctx);
      } else if (url.pathname === '/api/stats' && request.method === 'GET') {
        response = await handleStats(request, env);
      } else {
        response = Response.json({ error: 'Not found' }, { status: 404 });
      }
    } catch (err) {
      console.error('Unhandled error:', err);
      response = Response.json({ error: 'Internal server error' }, { status: 500 });
    }

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(origin))) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
