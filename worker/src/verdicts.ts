/* ------------------------------------------------------------------ */
/*  Plain-English verdicts for the graded report                      */
/* ------------------------------------------------------------------ */

export function overallVerdict(grade: string): string {
  const letter = grade.charAt(0);
  switch (letter) {
    case 'A':
      return 'Your site is doing its job. Nice work.';
    case 'B':
      return 'Solid foundation, but you\'re leaving leads on the table.';
    case 'C':
      return 'Your site is costing you business. Fixable, but don\'t wait.';
    case 'D':
      return 'Your site is letting leads slip through your fingers.';
    default:
      return 'Your site is actively working against you. Every day this stays live, you\'re losing money.';
  }
}

export function wastedSpendVerdict(
  spend: { low: number; high: number; monthlySpend: number; isEstimated: boolean },
  businessType: string,
): string {
  const low = spend.low.toLocaleString();
  const high = spend.high.toLocaleString();
  const monthly = spend.monthlySpend.toLocaleString();

  if (spend.isEstimated) {
    return (
      `The average ${businessType.toLowerCase()} business spends ~$${monthly}/mo on ads ` +
      `(LocaliQ, 2025). Based on your site's score, we estimate ` +
      `$${low}–$${high}/mo is lost to visitors who leave before converting. ` +
      `Google data shows 53% of mobile visitors abandon sites that take over 3 seconds to load.`
    );
  }

  return (
    `At $${monthly}/mo in ad spend, we estimate $${low}–$${high}/mo ` +
    `is wasted on visitors who leave before converting. ` +
    `Google data shows 53% of mobile visitors abandon sites that take over 3 seconds to load.`
  );
}
