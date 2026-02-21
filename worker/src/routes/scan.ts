import type { Env } from '../index';
import { fetchAndParse } from '../analyzers/fetch-page';
import { runPageSpeed } from '../analyzers/pagespeed';
import { analyzeMobile } from '../analyzers/mobile';
import { analyzeLeadCapture } from '../analyzers/lead-capture';
import { analyzeTrust } from '../analyzers/trust';
import { analyzeSpeed } from '../analyzers/speed';
import { analyzeSeo } from '../analyzers/seo';
import { analyzeAdReadiness } from '../analyzers/ad-readiness';
import { gradeReport } from '../scoring';
import { overallVerdict, wastedSpendVerdict } from '../verdicts';
import { recordScan } from '../analytics';

export async function handleScan(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    // 1. Parse JSON body
    const body = (await request.json()) as {
      url?: string;
      businessType?: string;
      adSpend?: string;
    };

    const { url, businessType, adSpend } = body;

    // 2. Validate required fields
    if (!url || !businessType) {
      return Response.json(
        { error: 'Missing required fields: url and businessType are required.' },
        { status: 400 },
      );
    }

    // 3. Fetch page HTML and run PageSpeed in parallel
    const [page, pageSpeed] = await Promise.all([
      fetchAndParse(url),
      runPageSpeed(url, env.PAGESPEED_API_KEY),
    ]);

    // 4. Run all 6 analyzers (PageSpeed may be null if API unavailable)
    const categories = [
      analyzeMobile(page, pageSpeed),
      analyzeLeadCapture(page),
      analyzeTrust(page),
      analyzeSpeed(pageSpeed),
      analyzeSeo(page, businessType),
      analyzeAdReadiness(page, pageSpeed, businessType),
    ];

    // 5. Grade the report
    const graded = gradeReport(categories, adSpend ?? null, businessType);

    // 6. Generate report ID
    const reportId = crypto.randomUUID().slice(0, 12);

    // 7. Build the verdict strings
    const verdict = overallVerdict(graded.overallGrade);
    const wastedVerdict = graded.wastedSpend
      ? wastedSpendVerdict(graded.wastedSpend, businessType)
      : null;

    // 8. Build stored report object
    const storedReport = {
      id: reportId,
      url,
      finalUrl: page.finalUrl,
      businessType,
      adSpend: adSpend ?? null,
      scannedAt: new Date().toISOString(),
      overallScore: graded.overallScore,
      overallGrade: graded.overallGrade,
      verdict,
      wastedSpend: graded.wastedSpend,
      wastedSpendVerdict: wastedVerdict,
      categories: graded.categories,
      priorityFixes: graded.priorityFixes.slice(0, 5),
      pageTitle: page.title,
    };

    // 9. Store in KV with 30-day TTL
    await env.REPORTS.put(
      'report:' + reportId,
      JSON.stringify(storedReport),
      { expirationTtl: 30 * 24 * 60 * 60 },
    );

    // 10. Record analytics (non-blocking)
    ctx.waitUntil(recordScan(env, businessType, graded.overallGrade, adSpend ?? null));

    // 11. Return the report
    return Response.json(storedReport);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Scan failed:', err);
    return Response.json(
      { error: `Scan failed: ${message}` },
      { status: 500 },
    );
  }
}
