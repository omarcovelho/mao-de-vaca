import { Link } from 'react-router-dom';

type OnboardingPromptProps = {
  onSkip: () => void;
};

export function OnboardingPrompt({ onSkip }: OnboardingPromptProps) {
  return (
    <section className="onboarding" aria-labelledby="onboarding-title">
      <h2 id="onboarding-title">Cadastre suas contas e cartões</h2>
      <p>
        Para começar, cadastre ao menos uma conta bancária e, se quiser, seus
        cartões de crédito. Você pode pular e fazer isso depois.
      </p>
      <div className="onboarding-actions">
        <Link to="/contas" className="button-link">
          Cadastrar contas
        </Link>
        <Link to="/cartoes" className="button-link">
          Cadastrar cartões
        </Link>
        <button type="button" className="skip-button" onClick={onSkip}>
          Pular
        </button>
      </div>
    </section>
  );
}
