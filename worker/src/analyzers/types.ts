/**
 * Shared types used by all category analyzers.
 */

export interface Finding {
  label: string;       // e.g. "Click-to-call phone number"
  pass: boolean;
  detail: string;      // Plain English verdict
  impact: 'high' | 'medium' | 'low';
}

export interface CategoryResult {
  name: string;
  score: number;       // 0-100
  findings: Finding[];
}

/** Weighted score calculation shared by every analyzer. */
export function calculateCategoryScore(findings: Finding[]): number {
  let earned = 0, total = 0;
  for (const f of findings) {
    const weight = f.impact === 'high' ? 30 : f.impact === 'medium' ? 20 : 10;
    total += weight;
    if (f.pass) earned += weight;
  }
  return total === 0 ? 0 : Math.round((earned / total) * 100);
}
