import type { Env } from '../index';

/* ------------------------------------------------------------------ */
/*  HTML escape helper to prevent XSS in email content                */
/* ------------------------------------------------------------------ */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/*  Interfaces                                                        */
/* ------------------------------------------------------------------ */

interface LeadRequest {
  name?: string;
  email?: string;
  phone?: string;
  reportId?: string;
}

interface StoredReport {
  url: string;
  businessType: string;
  overallGrade: string;
  overallScore: number;
  wastedSpendVerdict: string | null;
  priorityFixes: { label: string; detail: string }[];
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                     */
/* ------------------------------------------------------------------ */

export async function handleLead(request: Request, env: Env): Promise<Response> {
  // 1. Parse JSON body
  const body = (await request.json()) as LeadRequest;
  const { name, email, phone, reportId } = body;

  // 2. Validate required fields
  if (!name || !email || !reportId) {
    return Response.json(
      { error: 'Missing required fields: name, email, and reportId are required.' },
      { status: 400 },
    );
  }

  // 3. Fetch the report from KV for context
  const reportData = await env.REPORTS.get('report:' + reportId);

  // 4. Parse the report (may be null if expired)
  const report: StoredReport | null = reportData ? JSON.parse(reportData) : null;

  // 5. Build and send email via Resend
  const overallGrade = report ? escapeHtml(report.overallGrade) : 'N/A';
  const overallScore = report ? report.overallScore : 'N/A';
  const websiteUrl = report ? escapeHtml(report.url) : 'N/A';
  const businessType = report ? escapeHtml(report.businessType) : 'N/A';

  const wastedSection = report?.wastedSpendVerdict
    ? `<p><strong>Wasted Spend:</strong> ${escapeHtml(report.wastedSpendVerdict)}</p>`
    : '';

  let topIssuesSection = '';
  if (report?.priorityFixes && report.priorityFixes.length > 0) {
    const items = report.priorityFixes
      .slice(0, 3)
      .map((fix) => `<li><strong>${escapeHtml(fix.label)}</strong> &mdash; ${escapeHtml(fix.detail)}</li>`)
      .join('');
    topIssuesSection = `<h4>Top Issues</h4><ol>${items}</ol>`;
  }

  const reportLink = `https://sitegrade.pro/report.html?id=${encodeURIComponent(reportId)}`;

  const html = [
    `<h2>New Consultation Request</h2>`,
    `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
    `<p><strong>Phone:</strong> ${phone ? escapeHtml(phone) : 'Not provided'}</p>`,
    `<hr>`,
    `<h3>Their Report</h3>`,
    `<p><strong>Website:</strong> ${websiteUrl}</p>`,
    `<p><strong>Business Type:</strong> ${businessType}</p>`,
    `<p><strong>Overall Grade:</strong> ${overallGrade} (${overallScore}/100)</p>`,
    wastedSection,
    topIssuesSection,
    `<p><a href="${reportLink}">View Full Report</a></p>`,
  ].join('\n');

  const subjectGrade = report ? report.overallGrade : 'N/A';

  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SiteGrade <noreply@updates.sitegrade.pro>',
        to: env.LEAD_EMAIL_TO,
        subject: `New Lead: ${name} — Grade ${subjectGrade}`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error('Resend API error:', emailResponse.status, errText);
    }
  } catch (err) {
    // Don't fail the request if email send fails
    console.error('Failed to send lead notification email:', err);
  }

  // 6. Return success regardless of email outcome
  return Response.json({ success: true });
}
