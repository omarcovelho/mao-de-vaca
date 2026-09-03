import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconShell({
  children,
  title,
  ...props
}: IconProps & { children: ReactNode; title: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
      {...props}
    >
      <title>{title}</title>
      {children}
    </svg>
  );
}

export function AccountOriginIcon(props: IconProps) {
  return (
    <IconShell title="Conta" {...props}>
      <path d="M4 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
      <path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H16" />
      <circle cx="16.5" cy="14" r="1" fill="currentColor" stroke="none" />
    </IconShell>
  );
}

export function CardOriginIcon(props: IconProps) {
  return (
    <IconShell title="Cartão" {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </IconShell>
  );
}
