import type { Finding, CategoryResult } from './analyzers/types';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                        */
/* ------------------------------------------------------------------ */

export interface PriorityFix {
  label: string;
  detail: string;
  effort: 'quick' | 'medium' | 'involved';
  impact: 'high' | 'medium' | 'low';
}

export interface GradedCategory {
  name: string;
  score: number;
  grade: string;
  gradeColor: string;
  findings: Finding[];
}

export interface GradedReport {
  overallScore: number;
  overallGrade: string;
  categories: GradedCategory[];
  priorityFixes: PriorityFix[];
  wastedSpend: { low: number; high: number } | null;
}

/* ------------------------------------------------------------------ */
/*  Grade helpers                                                     */
/* ------------------------------------------------------------------ */

const GRADE_THRESHOLDS: [number, string][] = [
  [97, 'A+'],
  [93, 'A'],
  [90, 'A-'],
  [87, 'B+'],
  [83, 'B'],
  [80, 'B-'],
  [77, 'C+'],
  [73, 'C'],
  [70, 'C-'],
  [67, 'D+'],
  [63, 'D'],
  [60, 'D-'],
];

export function scoreToGrade(score: number): string {
  for (const [threshold, grade] of GRADE_THRESHOLDS) {
    if (score >= threshold) return grade;
  }
  return 'F';
}

export function gradeColor(grade: string): string {
  const letter = grade.charAt(0);
  switch (letter) {
    case 'A': return '#22c55e';
    case 'B': return '#3b82f6';
    case 'C': return '#eab308';
    case 'D': return '#f97316';
    default:  return '#ef4444';
  }
}

/* ------------------------------------------------------------------ */
/*  Category weights                                                  */
/* ------------------------------------------------------------------ */

const CATEGORY_WEIGHTS: Record<string, number> = {
  'Mobile Experience':     0.25,
  'Lead Capture':          0.25,
  'Trust & Credibility':   0.15,
  'Page Speed':            0.15,
  'SEO Basics':            0.10,
  'Ad Landing Readiness':  0.10,
};

/* ------------------------------------------------------------------ */
/*  Ad-spend mapping & waste estimate                                 */
/* ------------------------------------------------------------------ */

const SPEND_MIDPOINTS: Record<string, number> = {
  'Under $500':      350,
  '$500-$1,000':     750,
  '$1,000-$2,500':   1750,
  '$2,500-$5,000':   3750,
  '$5,000+':         6500,
};

function estimateWaste(
  score: number,
  adSpend: string | null,
): { low: number; high: number } | null {
  if (!adSpend) return null;

  const midpoint = SPEND_MIDPOINTS[adSpend];
  if (midpoint === undefined) return null;

  const wasteFactor = ((100 - score) / 100) * 0.7;
  const midWaste = midpoint * wasteFactor;

  return {
    low:  Math.round(midWaste * 0.8),
    high: Math.round(midWaste * 1.2),
  };
}

/* ------------------------------------------------------------------ */
/*  Priority-fix helpers                                              */
/* ------------------------------------------------------------------ */

const IMPACT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const EFFORT_ORDER: Record<string, number> = { quick: 0, medium: 1, involved: 2 };

function effortFromImpact(impact: 'high' | 'medium' | 'low'): 'quick' | 'medium' | 'involved' {
  switch (impact) {
    case 'high':   return 'quick';
    case 'medium': return 'medium';
    case 'low':    return 'involved';
  }
}

function collectPriorityFixes(categories: CategoryResult[]): PriorityFix[] {
  const fixes: PriorityFix[] = [];

  for (const cat of categories) {
    for (const f of cat.findings) {
      if (!f.pass) {
        fixes.push({
          label:  f.label,
          detail: f.detail,
          effort: effortFromImpact(f.impact),
          impact: f.impact,
        });
      }
    }
  }

  fixes.sort((a, b) => {
    const impactDiff = IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact];
    if (impactDiff !== 0) return impactDiff;
    return EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort];
  });

  return fixes;
}

/* ------------------------------------------------------------------ */
/*  Main grading function                                             */
/* ------------------------------------------------------------------ */

export function gradeReport(
  categories: CategoryResult[],
  adSpend: string | null,
): GradedReport {
  /* Weighted overall score */
  let weightedSum = 0;
  let weightTotal = 0;

  const gradedCategories: GradedCategory[] = categories.map((cat) => {
    const weight = CATEGORY_WEIGHTS[cat.name] ?? 0;
    weightedSum += cat.score * weight;
    weightTotal += weight;

    const grade = scoreToGrade(cat.score);

    return {
      name:       cat.name,
      score:      cat.score,
      grade,
      gradeColor: gradeColor(grade),
      findings:   cat.findings,
    };
  });

  const overallScore = weightTotal > 0
    ? Math.round(weightedSum / weightTotal)
    : 0;
  const overallGrade = scoreToGrade(overallScore);

  return {
    overallScore,
    overallGrade,
    categories:   gradedCategories,
    priorityFixes: collectPriorityFixes(categories),
    wastedSpend:  estimateWaste(overallScore, adSpend),
  };
}
