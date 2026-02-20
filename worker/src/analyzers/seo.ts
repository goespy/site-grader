/**
 * SEO Basics Analyzer (weight: 10% of overall score).
 *
 * Evaluates whether the site has the fundamentals for showing up in
 * search results — title tag, meta description, headings, SSL, and
 * local business schema.
 */

import type { ParsedPage } from './fetch-page.js';
import { type CategoryResult, type Finding, calculateCategoryScore } from './types.js';

export function analyzeSeo(page: ParsedPage, businessType: string): CategoryResult {
  const findings: Finding[] = [];

  // 1. Title tag (high impact)
  const titleLen = page.title.length;
  const titleIsGeneric = /^home$/i.test(page.title.trim());
  const titleOk = titleLen > 10 && !titleIsGeneric;
  findings.push({
    label: 'Title tag',
    pass: titleOk,
    detail: titleOk
      ? `Your page title is "${page.title}" — it's descriptive and tells Google what your business does. Good.`
      : titleLen === 0
        ? 'Your page has no title tag. This is the single most important thing Google reads to understand what your page is about. Add a title like "Smith Roofing — Licensed Roofer in Naples, FL".'
        : titleIsGeneric
          ? `Your page title is just "Home." That tells Google nothing about your business. Change it to something like "${businessType} Services — Your City, State".`
          : `Your page title is only ${titleLen} characters. That's too short to be useful. Include your business name, what you do, and where you are.`,
    impact: 'high',
  });

  // 2. Meta description (high impact)
  const descLen = page.metaDescription.length;
  findings.push({
    label: 'Meta description',
    pass: descLen > 20,
    detail: descLen > 20
      ? `You have a meta description (${descLen} characters). This is the snippet Google shows under your title in search results — it helps convince people to click.`
      : descLen === 0
        ? 'Your page has no meta description. Google will pick random text from your page to show in search results — and it usually picks something awkward. Write a 1–2 sentence summary of what you do and where.'
        : `Your meta description is only ${descLen} characters. That's too short to be useful in search results. Aim for 120–160 characters that describe your services and location.`,
    impact: 'high',
  });

  // 3. Main heading H1 (medium impact)
  const h1Text = page.h1.replace(/<[^>]*>/g, '').trim();
  findings.push({
    label: 'Main heading (H1)',
    pass: h1Text.length > 0,
    detail: h1Text.length > 0
      ? `Your main heading is "${h1Text}". Google uses this to understand your page's primary topic.`
      : 'Your page is missing a main heading. This is like a newspaper article with no headline — Google and visitors both use it to understand what the page is about.',
    impact: 'medium',
  });

  // 4. SSL certificate (medium impact)
  findings.push({
    label: 'SSL certificate (secure site)',
    pass: page.isHttps,
    detail: page.isHttps
      ? 'Your site uses a secure connection (the lock icon in the browser). Google requires this, and customers trust it.'
      : 'Your site doesn\'t use a secure connection. Browsers show a "Not Secure" warning, which scares customers away. Google also penalizes non-secure sites in search rankings. Most hosting providers offer free SSL certificates.',
    impact: 'medium',
  });

  // 5. Local business schema (medium impact)
  findings.push({
    label: 'Local business schema',
    pass: page.hasLocalSchema,
    detail: page.hasLocalSchema
      ? 'Your site includes structured data that tells Google you\'re a local business. This helps you show up in Google\'s map results and local searches.'
      : page.hasSchema
        ? 'Your site has some structured data, but it doesn\'t specifically identify you as a local business. Updating this can help you show up in "near me" searches and Google Maps.'
        : `Your site doesn't have any structured data. This is behind-the-scenes code that helps Google understand you're a local ${businessType.toLowerCase()} business. Without it, you're harder to find in local searches.`,
    impact: 'medium',
  });

  return {
    name: 'SEO Basics',
    score: calculateCategoryScore(findings),
    findings,
  };
}
