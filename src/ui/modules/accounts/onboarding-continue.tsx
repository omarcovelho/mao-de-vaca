import { Link } from 'react-router-dom';
import { OnboardingFinalizeButton } from './onboarding-finalize-button';
import { OnboardingOriginsList } from './onboarding-origins-list';

type OnboardingContinueProps = {
  message?: string;
  refreshKey?: number;
  anotherAction?: {
    label: string;
    onClick: () => void;
  };
  otherOrigin?: {
    label: string;
    to: string;
  };
};

export function OnboardingContinue({
  message,
  refreshKey = 0,
  anotherAction,
  otherOrigin,
}: OnboardingContinueProps) {
  return (
    <section className="onboarding-continue" aria-live="polite">
      {message ? (
        <p className="onboarding-continue__message">{message}</p>
      ) : null}
      <div className="onboarding__actions">
        {anotherAction ? (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={anotherAction.onClick}
          >
            {anotherAction.label}
          </button>
        ) : null}
        {otherOrigin ? (
          <Link to={otherOrigin.to} className="btn btn--secondary">
            {otherOrigin.label}
          </Link>
        ) : (
          <>
            <Link to="/contas" className="btn btn--secondary">
              Adicionar conta
            </Link>
            <Link to="/cartoes" className="btn btn--secondary">
              Adicionar cartão
            </Link>
          </>
        )}
      </div>
      <OnboardingOriginsList refreshKey={refreshKey} />
      <OnboardingFinalizeButton />
    </section>
  );
}
