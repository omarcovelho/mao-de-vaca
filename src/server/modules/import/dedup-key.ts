import { createHash } from 'crypto';

export function buildDedupKey(
  accountId: string,
  competenceDate: string,
  amount: string,
  description: string,
): string {
  const normalized = description.trim().replace(/\s+/g, ' ').toLowerCase();
  return createHash('sha256')
    .update(`${accountId}|${competenceDate}|${amount}|${normalized}`)
    .digest('hex');
}
