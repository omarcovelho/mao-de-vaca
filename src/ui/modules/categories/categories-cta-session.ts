export const CATEGORIES_CTA_DISMISSED_KEY = 'mdv_categories_cta_dismissed';

export function isCategoriesCtaDismissed(): boolean {
  return sessionStorage.getItem(CATEGORIES_CTA_DISMISSED_KEY) === '1';
}

export function dismissCategoriesCta(): void {
  sessionStorage.setItem(CATEGORIES_CTA_DISMISSED_KEY, '1');
}
