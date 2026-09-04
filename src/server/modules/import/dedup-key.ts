import { createHash } from 'crypto';

export function fingerprintBase(
  originId: string,
  competenceDate: string,
  amount: string,
  description: string,
): string {
  const normalized = description.trim().replace(/\s+/g, ' ').toLowerCase();
  return `${originId}|${competenceDate}|${amount}|${normalized}`;
}

export function buildDedupKey(
  originId: string,
  competenceDate: string,
  amount: string,
  description: string,
  occurrence = 1,
): string {
  const base = fingerprintBase(originId, competenceDate, amount, description);
  const material = occurrence <= 1 ? base : `${base}|#${occurrence}`;
  return createHash('sha256').update(material).digest('hex');
}

export function assignOccurrences(
  rows: Array<{
    competenceDate: string;
    amount: string;
    description: string;
  }>,
  originId: string,
): number[] {
  const counts = new Map<string, number>();
  return rows.map((row) => {
    const base = fingerprintBase(
      originId,
      row.competenceDate,
      row.amount,
      row.description,
    );
    const next = (counts.get(base) ?? 0) + 1;
    counts.set(base, next);
    return next;
  });
}
