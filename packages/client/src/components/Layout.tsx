import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';
import './Layout.css';

/**
 * Global shell layout.
 *
 * Desktop (≥ 768px): fixed sidebar on the left, main content fills the rest.
 * Mobile (< 768px): full-width content with a fixed bottom navigation bar.
 *
 * Renders correctly from 320px to 1440px without horizontal scroll (Req 19.1).
 * All interactive elements are keyboard-navigable with visible focus indicators (Req 19.2).
 */
export default function Layout() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: '🏠' },
    { to: '/messages', label: 'Messages', icon: '💬' },
    { to: '/discover', label: t('nav.discover'), icon: '🗺️' },
    { to: '/events', label: t('nav.events'), icon: '📅' },
    { to: '/profile', label: t('nav.profile'), icon: '👤' },
  ];

  return (
    <div className="layout">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <nav className="layout__sidebar" aria-label={t('nav.main')}>
        <div className="layout__logo" aria-label="ShowUp2Move">
          <span aria-hidden="true">🏃</span>
          <span className="layout__logo-text">ShowUp2Move</span>
        </div>
        <ul className="layout__nav-list" role="list">
          {navItems.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  'layout__nav-link' + (isActive ? ' layout__nav-link--active' : '')
                }
              >
                <span className="layout__nav-icon" aria-hidden="true">
                  {icon}
                </span>
                <span className="layout__nav-label">{label}</span>
              </NavLink>
            </li>
          ))}
          
          {/* Settings Theme Toggle */}
          <li>
            <button 
              onClick={toggleTheme} 
              className="layout__nav-link" 
              style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <span className="layout__nav-icon" aria-hidden="true">
                {theme === 'light' ? '🌙' : '☀️'}
              </span>
              <span className="layout__nav-label">Theme</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="layout__main" id="main-content">
        <Outlet />
      </main>

      {/* ── Mobile bottom navigation ─────────────────────────────────────── */}
      <nav className="layout__bottom-nav" aria-label={t('nav.main')}>
        <ul className="layout__bottom-nav-list" role="list">
          {navItems.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  'layout__bottom-nav-link' + (isActive ? ' layout__bottom-nav-link--active' : '')
                }
                aria-label={label}
              >
                <span className="layout__bottom-nav-icon" aria-hidden="true">
                  {icon}
                </span>
                <span className="layout__bottom-nav-label">{label}</span>
              </NavLink>
            </li>
          ))}
          
          {/* Settings Theme Toggle (Mobile) */}
          <li>
            <button 
              onClick={toggleTheme} 
              className="layout__bottom-nav-link" 
              aria-label="Theme"
              style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
            >
              <span className="layout__bottom-nav-icon" aria-hidden="true">
                {theme === 'light' ? '🌙' : '☀️'}
              </span>
              <span className="layout__bottom-nav-label">Theme</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
