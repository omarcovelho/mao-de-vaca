import { NavLink } from 'react-router-dom';
import { useSetupStatus } from './setup-status-context';

export function SetupOriginSwitcher() {
  const { startOnboarding } = useSetupStatus();

  return (
    <nav
      className="setup-switcher pill-group"
      aria-label="Alternar entre conta e cartão"
    >
      <NavLink
        to="/contas"
        onClick={startOnboarding}
        className={({ isActive }) =>
          `pill setup-switcher__link${isActive ? ' pill--active' : ''}`
        }
      >
        Conta
      </NavLink>
      <NavLink
        to="/cartoes"
        onClick={startOnboarding}
        className={({ isActive }) =>
          `pill setup-switcher__link${isActive ? ' pill--active' : ''}`
        }
      >
        Cartão
      </NavLink>
    </nav>
  );
}
