/**
 * AI Content Review — calls MiniMax-M2.5 via OpenRouter to evaluate
 * copy quality, messaging clarity, and conversion persuasiveness.
 *
 * Returns null on any error so the report still generates with the
 * 6 regex-based analyzers.
 */

import type { ParsedPage } from './fetch-page';
import type { Finding, CategoryResult } from './types';
import { calculateCategoryScore } from './types';

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

/** Strip HTML tags, collapse whitespace, truncate to ~4K chars. */
export function extractVisibleText(html: string): string {
  // Remove script and style blocks entirely
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Strip remaining tags
  text = text.replace(/<[^>]*>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Truncate to ~4,000 characters
  return text.slice(0, 4000);
}

/**
 * Build the best available text for the AI to review.
 * JS-rendered sites have almost no visible text in raw HTML, so we
 * supplement with structured data the page parser already extracted.
 */
function buildPageText(page: ParsedPage): string {
  const rawText = extractVisibleText(page.html);

  // If we got a decent amount of text, use it directly
  if (rawText.length >= 200) {
    return rawText;
  }

  // For JS-rendered sites, build text from parsed signals
  const parts: string[] = [];
  if (page.title) parts.push(`Page title: ${page.title}`);
  if (page.metaDescription) parts.push(`Meta description: ${page.metaDescription}`);
  if (page.h1) parts.push(`Main headline: ${page.h1}`);
  if (page.ogTitle) parts.push(`OG title: ${page.ogTitle}`);
  if (page.ogDescription) parts.push(`OG description: ${page.ogDescription}`);
  if (page.phoneNumbers.length > 0) parts.push(`Phone numbers found: ${page.phoneNumbers.join(', ')}`);
  if (page.hasClickToCall) parts.push('Has click-to-call links');
  if (page.formCount > 0) parts.push(`Has ${page.formCount} form(s)`);
  if (page.hasTestimonials) parts.push('Has testimonials section');
  if (page.hasReviews) parts.push('Has reviews/ratings');
  if (page.hasLicense) parts.push('Mentions licensing/insurance');
  if (page.ctaCount > 0) parts.push(`Found ${page.ctaCount} CTA keywords`);
  if (page.hasCtaAboveFold) parts.push('Has CTA above the fold');
  if (page.mentionsLocation) parts.push('Mentions service location');
  if (page.mentionsService) parts.push('Mentions service type');

  // Also append whatever raw text we got
  if (rawText.length > 0) parts.push(`\nRaw page text: ${rawText}`);

  const combined = parts.join('\n');
  if (combined.length < 50) {
    return ''; // Not enough content for a meaningful review
  }

  return combined;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a conversion rate optimization expert reviewing a home service business website. Your job is to evaluate the visible copy and messaging — not the technical implementation.

Return EXACTLY 5 findings as a JSON array. Each finding must have:
- "label": short description (3-8 words)
- "pass": true if the page does this well, false if it needs improvement
- "detail": 1-2 sentences explaining what you found and a specific recommendation. Use examples when possible.
- "impact": "high", "medium", or "low"

Evaluate these 5 areas (one finding per area, in order):
1. Headline clarity — Does the hero communicate what/where/who within 5 seconds?
2. CTA persuasiveness — Is the call-to-action specific and compelling (not generic)?
3. Value proposition — Is there a clear reason to choose this business over competitors?
4. Industry-specific messaging — Does the copy address what this trade's customers actually care about?
5. Trust language — Does the copy itself build credibility (beyond just having review widgets)?

Return ONLY the JSON array, no markdown fences, no extra text.`;

function buildUserMessage(
  businessType: string,
  adSpend: string | null,
  visibleText: string,
): string {
  let msg = `Business type: ${businessType}\n`;
  if (adSpend && adSpend !== 'none') {
    msg += `Monthly ad spend: ${adSpend}\n`;
  }
  msg += `\nPage text:\n${visibleText}`;
  return msg;
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

interface AiFinding {
  label: string;
  pass: boolean;
  detail: string;
  impact: string;
}

interface Env {
  OPENROUTER_API_KEY?: string;
}

export async function runAiReview(
  page: ParsedPage,
  businessType: string,
  adSpend: string | null,
  env: Env,
): Promise<CategoryResult | null> {
  // Skip silently if API key not configured
  if (!env.OPENROUTER_API_KEY) {
    return null;
  }

  try {
    const visibleText = buildPageText(page);
    if (!visibleText) {
      console.error('AI review: not enough page text to review');
      return null;
    }

    console.log(`AI review: sending ${visibleText.length} chars to model`);

    // 25-second timeout (reasoning models need more time)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'minimax/minimax-m2.5',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(businessType, adSpend, visibleText) },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`AI review API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('AI review: empty response content');
      return null;
    }

    // Parse JSON — reasoning models may output thinking tokens before the array
    // Find the first '[' and last ']' to extract the JSON array
    const arrStart = content.indexOf('[');
    const arrEnd = content.lastIndexOf(']');
    if (arrStart === -1 || arrEnd === -1 || arrEnd <= arrStart) {
      console.error('AI review: no JSON array found in response');
      return null;
    }
    const jsonStr = content.slice(arrStart, arrEnd + 1);
    const parsed: AiFinding[] = JSON.parse(jsonStr);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error('AI review: response is not a non-empty array');
      return null;
    }

    // Map to Finding[], validating each item
    const findings: Finding[] = parsed
      .filter(
        (f) =>
          typeof f.label === 'string' &&
          typeof f.pass === 'boolean' &&
          typeof f.detail === 'string' &&
          ['high', 'medium', 'low'].includes(f.impact),
      )
      .map((f) => ({
        label: f.label,
        pass: f.pass,
        detail: f.detail,
        impact: f.impact as 'high' | 'medium' | 'low',
      }));

    if (findings.length === 0) {
      console.error('AI review: no valid findings after filtering');
      return null;
    }

    return {
      name: 'Content Quality',
      score: calculateCategoryScore(findings),
      findings,
    };
  } catch (err) {
    console.error('AI review failed:', err);
    return null;
  }
}
