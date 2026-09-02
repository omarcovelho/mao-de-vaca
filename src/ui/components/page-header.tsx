import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
};

export function PageHeader({ title, subtitle, trailing }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="page-header__trailing">{trailing}</div> : null}
    </header>
  );
}
