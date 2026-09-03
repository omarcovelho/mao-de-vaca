import { formatMonthLabel } from '../transactions/month';
import type { MonthlyEvolutionItem } from './types';

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

type MonthlyEvolutionChartProps = {
  items: MonthlyEvolutionItem[];
};

export function MonthlyEvolutionChart({ items }: MonthlyEvolutionChartProps) {
  if (items.length === 0) {
    return (
      <p className="page__empty">Sem dados para a evolução mensal.</p>
    );
  }

  const maxExpense = Math.max(...items.map((item) => item.expenseTotal), 0);
  const chartMax = maxExpense > 0 ? maxExpense : 1;

  return (
    <div className="monthly-chart" role="img" aria-label="Evolução mensal de gastos">
      <ul className="monthly-chart__bars">
        {items.map((item) => {
          const heightPct = (item.expenseTotal / chartMax) * 100;
          const shortLabel = formatMonthLabel(item.month).split(' ')[0];
          return (
            <li key={item.month} className="monthly-chart__col">
              <div className="monthly-chart__value">
                {formatMoney(item.expenseTotal)}
              </div>
              <div className="monthly-chart__track">
                <span
                  className="monthly-chart__bar"
                  style={{ height: `${Math.max(heightPct, item.expenseTotal > 0 ? 4 : 0)}%` }}
                  title={`${formatMonthLabel(item.month)}: ${formatMoney(item.expenseTotal)}`}
                />
              </div>
              <div className="monthly-chart__label">{shortLabel}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
