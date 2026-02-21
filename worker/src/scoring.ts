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
  wastedSpend: WastedSpend | null;
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

/**
 * Industry-average monthly ad spend by trade.
 * Sources: LocaliQ 2025 Search Ad Benchmarks (3,211 campaigns),
 * HookAgency HVAC Marketing Budget Guide (2025).
 */
const INDUSTRY_AD_SPEND: Record<string, number> = {
  'Pool Builder':        1500,  // LocaliQ: Pools & Spas $45 CPL × ~33 leads/mo
  'HVAC':                2600,  // HookAgency: 40 leads × $65 CPL
  'Roofing':             1800,  // HookAgency: 20 leads × $80 CPL; LocaliQ: $228 CPL
  'Plumbing':            2750,  // HookAgency: 50 leads × $55 CPL
  'Electrical':          2000,  // LocaliQ: $12.18 avg CPC, ~$100 CPL
  'Landscaping':         1500,  // LocaliQ: mid-range CPL
  'Painting':            1200,  // LocaliQ: Paint & Painting $13.74 CPC
  'General Contractor':  2500,  // LocaliQ: $165.67 CPL, ~15 leads/mo
  'Other':               2000,  // Industry midpoint
};

export interface WastedSpend {
  low: number;
  high: number;
  monthlySpend: number;
  isEstimated: boolean;
}

function estimateWaste(
  score: number,
  adSpend: string | null,
  businessType: string,
): WastedSpend | null {
  let monthlySpend: number;
  let isEstimated: boolean;

  if (adSpend && adSpend !== 'none') {
    const midpoint = SPEND_MIDPOINTS[adSpend];
    if (midpoint === undefined) return null;
    monthlySpend = midpoint;
    isEstimated = false;
  } else if (adSpend === 'none') {
    // User explicitly said they don't run ads — skip waste calc
    return null;
  } else {
    // No ad spend provided — use industry average for their trade
    monthlySpend = INDUSTRY_AD_SPEND[businessType] ?? INDUSTRY_AD_SPEND['Other'];
    isEstimated = true;
  }

  const wasteFactor = ((100 - score) / 100) * 0.7;
  const midWaste = monthlySpend * wasteFactor;

  return {
    low:  Math.round(midWaste * 0.8),
    high: Math.round(midWaste * 1.2),
    monthlySpend,
    isEstimated,
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
  businessType: string,
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
    wastedSpend:  estimateWaste(overallScore, adSpend, businessType),
  };
}
