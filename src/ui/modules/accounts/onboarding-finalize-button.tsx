import { useNavigate } from 'react-router-dom';
import { useSetupStatus } from './setup-status-context';

export function OnboardingFinalizeButton() {
  const navigate = useNavigate();
  const { hasOrigins, finalizeOnboarding } = useSetupStatus();

  if (!hasOrigins) {
    return null;
  }

  function handleFinalize() {
    finalizeOnboarding();
    navigate('/', { replace: true });
  }

  return (
    <div className="onboarding-finalize">
      <button
        type="button"
        className="btn btn--primary"
        onClick={handleFinalize}
      >
        Finalizar configuração
      </button>
    </div>
  );
}
