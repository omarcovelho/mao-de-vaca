import { useEffect, useState } from 'react';
import * as accountsApi from './api';
import { OnboardingPrompt } from './onboarding-prompt';

const SKIP_KEY = 'mdv_onboarding_skipped';

export function HomePage() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const skipped = sessionStorage.getItem(SKIP_KEY) === '1';
        const status = await accountsApi.getSetupStatus();
        if (!cancelled) {
          setShowOnboarding(
            !skipped && !status.hasAccounts && !status.hasCards,
          );
        }
      } catch {
        if (!cancelled) {
          setShowOnboarding(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSkip() {
    sessionStorage.setItem(SKIP_KEY, '1');
    setShowOnboarding(false);
  }

  if (loading) {
    return (
      <section className="home">
        <p>Carregando…</p>
      </section>
    );
  }

  if (showOnboarding) {
    return <OnboardingPrompt onSkip={handleSkip} />;
  }

  return (
    <section className="home">
      <h1>Bem-vindo</h1>
      <p>
        Gerencie suas contas e cartões pelo menu. Em breve você poderá importar
        extratos.
      </p>
    </section>
  );
}
