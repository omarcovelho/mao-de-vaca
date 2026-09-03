import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconShell({ children, ...props }: IconProps & { children: ReactNode }) {
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
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

const ICONS: Record<string, (props: IconProps) => ReactNode> = {
  home: (props) => (
    <IconShell {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </IconShell>
  ),
  sparkles: (props) => (
    <IconShell {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" />
    </IconShell>
  ),
  utensils: (props) => (
    <IconShell {...props}>
      <path d="M8 3v8M6 3v5a2 2 0 0 0 4 0V3M8 11v10M16 3v7a2 2 0 0 0 2 2h0V3M18 12v9" />
    </IconShell>
  ),
  heart: (props) => (
    <IconShell {...props}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </IconShell>
  ),
  car: (props) => (
    <IconShell {...props}>
      <path d="M4 14h16l-1.5-5.5A2 2 0 0 0 16.6 7H7.4a2 2 0 0 0-1.9 1.5L4 14z" />
      <path d="M6.5 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
      <path d="M4 14v3h2.2M20 14v3h-2.2" />
    </IconShell>
  ),
  broom: (props) => (
    <IconShell {...props}>
      <path d="M14 3 5 18M10 8l6 6M9 20h10l-3-7-4 2" />
    </IconShell>
  ),
  scissors: (props) => (
    <IconShell {...props}>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="7" cy="17" r="2.5" />
      <path d="M9.5 8.5 20 18M9.5 15.5 20 6" />
    </IconShell>
  ),
  shopping: (props) => (
    <IconShell {...props}>
      <path d="M5 8h14l-1.2 11H6.2L5 8z" />
      <path d="M9 8V6.5A3 3 0 0 1 15 6.5V8" />
    </IconShell>
  ),
  ticket: (props) => (
    <IconShell {...props}>
      <path d="M4 9a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 0 0-4V5H4v4z" />
      <path d="M12 5v14" strokeDasharray="2 3" />
    </IconShell>
  ),
  book: (props) => (
    <IconShell {...props}>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5z" />
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3" />
    </IconShell>
  ),
  plane: (props) => (
    <IconShell {...props}>
      <path d="M12 3v7l8 3-8 3v5l-2.5-2.5L4 20.5V16l5.5-2.5L4 11V6.5L9.5 8.5 12 6z" />
    </IconShell>
  ),
  gift: (props) => (
    <IconShell {...props}>
      <rect x="4" y="10" width="16" height="10" rx="1" />
      <path d="M12 10v10M4 14h16M12 10c-2.5 0-4-1.5-4-3s2-2.5 4-1c2-1.5 4-.5 4 1s-1.5 3-4 3z" />
    </IconShell>
  ),
  'hand-heart': (props) => (
    <IconShell {...props}>
      <path d="M12 11s-2.5-1.6-2.5-3.5A1.8 1.8 0 0 1 12 6a1.8 1.8 0 0 1 2.5 1.5C14.5 9.4 12 11 12 11z" />
      <path d="M5 13.5c0-1.5 1.2-2.5 3-2.5h1.5L12 13l2.5-2h1.5c1.8 0 3 1 3 2.5V19H5v-5.5z" />
    </IconShell>
  ),
  ellipsis: (props) => (
    <IconShell {...props}>
      <circle cx="6" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </IconShell>
  ),
  wallet: (props) => (
    <IconShell {...props}>
      <path d="M4 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
      <path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H16" />
      <circle cx="16.5" cy="14" r="1" fill="currentColor" stroke="none" />
    </IconShell>
  ),
  arrows: (props) => (
    <IconShell {...props}>
      <path d="M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3" />
    </IconShell>
  ),
  tag: (props) => (
    <IconShell {...props}>
      <path d="M3 12V5.5A1.5 1.5 0 0 1 4.5 4H12l8 8-7.5 7.5L3 12z" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
    </IconShell>
  ),
};

export const CATEGORY_ICON_OPTIONS = [
  { key: 'home', label: 'Casa' },
  { key: 'sparkles', label: 'Assinaturas' },
  { key: 'utensils', label: 'Alimentação' },
  { key: 'heart', label: 'Saúde' },
  { key: 'car', label: 'Transporte' },
  { key: 'broom', label: 'Doméstico' },
  { key: 'scissors', label: 'Cuidados' },
  { key: 'shopping', label: 'Compras' },
  { key: 'ticket', label: 'Lazer' },
  { key: 'book', label: 'Educação' },
  { key: 'plane', label: 'Viagem' },
  { key: 'gift', label: 'Presentes' },
  { key: 'hand-heart', label: 'Doações' },
  { key: 'ellipsis', label: 'Outros' },
  { key: 'wallet', label: 'Renda' },
  { key: 'arrows', label: 'Transferência' },
  { key: 'tag', label: 'Geral' },
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_OPTIONS)[number]['key'];

export function CategoryIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Render = ICONS[icon] ?? ICONS.tag;
  return <span className={className}>{Render({})}</span>;
}

export const KIND_LABELS: Record<string, string> = {
  EXPENSE: 'Gasto',
  INCOME: 'Renda',
  NON_EXPENSE: 'Não-despesa',
};
