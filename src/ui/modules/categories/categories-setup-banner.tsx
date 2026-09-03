import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  dismissCategoriesCta,
  isCategoriesCtaDismissed,
} from './categories-cta-session';

export function CategoriesSetupBanner() {
  const [dismissed, setDismissed] = useState(isCategoriesCtaDismissed);

  if (dismissed) {
    return null;
  }

  return (
    <aside className="setup-banner" aria-label="Sugestão de categorias">
      <div>
        <p className="setup-banner__title">Cadastre suas categorias</p>
        <p className="setup-banner__text">
          Recomendamos ter categorias antes de importar extratos. Você pode
          ajustar a qualquer momento.
        </p>
      </div>
      <div className="setup-banner__actions">
        <Link to="/categorias" className="btn btn--primary">
          Ir para categorias
        </Link>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            dismissCategoriesCta();
            setDismissed(true);
          }}
        >
          Agora não
        </button>
      </div>
    </aside>
  );
}
