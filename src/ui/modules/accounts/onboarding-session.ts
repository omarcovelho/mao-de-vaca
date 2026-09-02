export const ONBOARDING_STARTED_KEY = 'mdv_onboarding_started';
export const ONBOARDING_FINALIZED_KEY = 'mdv_onboarding_finalized';

export function isOnboardingFinalized(): boolean {
  return sessionStorage.getItem(ONBOARDING_FINALIZED_KEY) === '1';
}

export function isOnboardingStarted(): boolean {
  return sessionStorage.getItem(ONBOARDING_STARTED_KEY) === '1';
}

export function markOnboardingStarted(): void {
  sessionStorage.setItem(ONBOARDING_STARTED_KEY, '1');
  sessionStorage.removeItem(ONBOARDING_FINALIZED_KEY);
}

export function markOnboardingFinalized(): void {
  sessionStorage.setItem(ONBOARDING_FINALIZED_KEY, '1');
}

export function clearOnboardingSession(): void {
  sessionStorage.removeItem(ONBOARDING_STARTED_KEY);
  sessionStorage.removeItem(ONBOARDING_FINALIZED_KEY);
}
