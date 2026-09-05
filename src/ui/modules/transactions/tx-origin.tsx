import { Link } from 'react-router-dom';
import {
  AccountOriginIcon,
  CardOriginIcon,
} from '../../components/origin-icon';
import type { TransactionItem } from './types';

function originLabel(
  label: string,
  bankName: string | undefined,
): string {
  return bankName ? `${label} · ${bankName}` : label;
}

export function TxOrigin({ item }: { item: TransactionItem }) {
  if (item.card) {
    const inner = (
      <>
        <CardOriginIcon className="tx-row__origin-icon" aria-hidden />
        <span
          className="tx-row__account-label"
          title={originLabel(item.card.label, item.card.bank.name)}
        >
          {item.card.label}
        </span>
      </>
    );
    if (item.invoiceId) {
      return (
        <Link
          to={`/cartoes?invoiceId=${item.invoiceId}`}
          className="tx-row__account tx-row__account--link"
        >
          {inner}
        </Link>
      );
    }
    return <span className="tx-row__account">{inner}</span>;
  }

  if (item.account) {
    const inner = (
      <>
        <AccountOriginIcon className="tx-row__origin-icon" aria-hidden />
        <span
          className="tx-row__account-label"
          title={originLabel(item.account.label, item.account.bank.name)}
        >
          {item.account.label}
        </span>
      </>
    );
    if (item.type === 'INVOICE_PAYMENT' && item.invoiceId) {
      return (
        <Link
          to={`/cartoes?invoiceId=${item.invoiceId}`}
          className="tx-row__account tx-row__account--link"
        >
          {inner}
        </Link>
      );
    }
    return <span className="tx-row__account">{inner}</span>;
  }

  return <span className="tx-row__account tx-row__account--empty">—</span>;
}
