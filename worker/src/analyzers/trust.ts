/**
 * Trust & Credibility Analyzer (weight: 15% of overall score).
 *
 * Evaluates whether the site builds enough trust for a homeowner to
 * hand over their money — testimonials, reviews, credentials, about
 * page, and real project photos.
 */

import type { ParsedPage } from './fetch-page.js';
import { type CategoryResult, type Finding, calculateCategoryScore } from './types.js';

export function analyzeTrust(page: ParsedPage): CategoryResult {
  const findings: Finding[] = [];

  // 1. Customer testimonials (high impact)
  findings.push({
    label: 'Customer testimonials',
    pass: page.hasTestimonials,
    detail: page.hasTestimonials
      ? 'Your site includes customer testimonials. Nothing sells a home service business like hearing from happy customers.'
      : 'We didn\'t find any customer testimonials on your site. Homeowners want to hear from other homeowners before they hire you. Even 2–3 short quotes make a big difference.',
    impact: 'high',
  });

  // 2. Review platform linked (high impact)
  findings.push({
    label: 'Review platform linked',
    pass: page.hasReviews,
    detail: page.hasReviews
      ? 'Your site links to or references review platforms like Google or Yelp. Third-party reviews carry more weight than anything you say about yourself.'
      : 'We didn\'t find any links to review sites like Google, Yelp, or the BBB. Linking to your reviews shows you have nothing to hide and builds instant trust.',
    impact: 'high',
  });

  // 3. License/insurance mentioned (medium impact)
  findings.push({
    label: 'License and insurance mentioned',
    pass: page.hasLicense,
    detail: page.hasLicense
      ? 'Your site mentions that you\'re licensed, insured, or bonded. Homeowners look for this — it tells them you\'re a legitimate operation.'
      : 'We didn\'t see any mention of licensing, insurance, or bonding on your site. Homeowners worry about liability. Mentioning your credentials puts their mind at ease.',
    impact: 'medium',
  });

  // 4. About page exists (medium impact)
  findings.push({
    label: 'About page exists',
    pass: page.hasAboutPage,
    detail: page.hasAboutPage
      ? 'You have an About page. Homeowners want to know who they\'re letting into their house — an About page with your story and team photos makes you feel real.'
      : 'We didn\'t find a link to an About page. Homeowners want to know who\'s behind the business. Adding a page with your story, your team, and how long you\'ve been around builds confidence.',
    impact: 'medium',
  });

  // 5. Real project photos (medium impact)
  const hasEnoughPhotos = page.hasRealPhotos && page.imageCount >= 3;
  findings.push({
    label: 'Real project photos',
    pass: hasEnoughPhotos,
    detail: hasEnoughPhotos
      ? `Your site has ${page.imageCount} images and they look like real project photos — not stock images. Showing your actual work is one of the best ways to win trust.`
      : page.imageCount < 3
        ? `Your site only has ${page.imageCount} image${page.imageCount === 1 ? '' : 's'}. Add photos of your real work — before and after shots, your team on the job, completed projects. Homeowners want to see what they're paying for.`
        : 'Your images look like stock photos. Homeowners can tell the difference. Replace them with photos of your actual work, your crew, and your trucks.',
    impact: 'medium',
  });

  return {
    name: 'Trust & Credibility',
    score: calculateCategoryScore(findings),
    findings,
  };
}
