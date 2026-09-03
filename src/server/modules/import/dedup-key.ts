import { createHash } from 'crypto';

export function buildDedupKey(
  originId: string,
  competenceDate: string,
  amount: string,
  description: string,
): string {
  const normalized = description.trim().replace(/\s+/g, ' ').toLowerCase();
  return createHash('sha256')
    .update(`${originId}|${competenceDate}|${amount}|${normalized}`)
    .digest('hex');
}
