export const CATEGORY_ICON_KEYS = [
  'home',
  'sparkles',
  'utensils',
  'heart',
  'car',
  'broom',
  'scissors',
  'shopping',
  'ticket',
  'book',
  'plane',
  'gift',
  'hand-heart',
  'ellipsis',
  'wallet',
  'arrows',
  'tag',
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

export const MAX_CATEGORY_DEPTH = 5;

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidCategoryColor(color: string): boolean {
  return COLOR_RE.test(color);
}

export function isValidCategoryIcon(icon: string): icon is CategoryIconKey {
  return (CATEGORY_ICON_KEYS as readonly string[]).includes(icon);
}
