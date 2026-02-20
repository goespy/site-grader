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
  low: number,
  high: number,
  adSpend: string,
): string {
  return (
    `You're spending ${adSpend}/mo on ads. Based on your site's performance, ` +
    `we estimate $${low}-$${high}/mo is wasted on visitors who leave before converting.`
  );
}
