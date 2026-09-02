import { SetupOriginSwitcher } from './setup-origin-switcher';

export function OnboardingSetupHeader() {
  return (
    <>
      <h2 className="onboarding__title">Vamos começar</h2>
      <p className="onboarding__text">
        Cadastre contas e cartões. Quando terminar, finalize a configuração.
      </p>
      <SetupOriginSwitcher />
    </>
  );
}
