export function toMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function monthBounds(monthKey: string): { from: string; to: string } {
  const [yearPart, monthPart] = monthKey.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function formatMonthLabel(monthKey: string): string {
  const [yearPart, monthPart] = monthKey.split('-');
  const date = new Date(Number(yearPart), Number(monthPart) - 1, 1);
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [yearPart, monthPart] = monthKey.split('-');
  const date = new Date(Number(yearPart), Number(monthPart) - 1 + delta, 1);
  return toMonthKey(date);
}
