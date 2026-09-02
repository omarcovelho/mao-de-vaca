import { SetupOriginSwitcher } from './setup-origin-switcher';

export function SetupPrompt() {
  return (
    <section className="onboarding" aria-labelledby="setup-title">
      <h2 id="setup-title" className="onboarding__title">
        Vamos começar
      </h2>
      <p className="onboarding__text">
        Cadastre ao menos uma conta ou cartão para acompanhar seus gastos e
        importar extratos.
      </p>
      <SetupOriginSwitcher />
    </section>
  );
}
