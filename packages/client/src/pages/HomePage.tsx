import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="home-container">
      {/* Navbar */}
      <nav className="home-nav" aria-label="Main navigation">
        <Link to="/" className="home-logo">
          <span className="home-logo-icon">⚡</span>
          {t('app.name')}
        </Link>
        <div className="home-nav-links">
          <Link to="/login" className="nav-btn nav-btn-purple">
            {t('nav.login')}
          </Link>
          <Link to="/register" className="nav-btn nav-btn-primary">
            {t('nav.register')}
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="home-hero">
        <h1 className="hero-title">
          Show up. <span className="hero-title-highlight">Move.</span> Connect.
        </h1>
        <p className="hero-subtitle">
          Spontaneous sports coordination made frictionless. Discover players nearby, form groups, and find venues—all with just one tap a day.
        </p>
        <div className="hero-cta-group">
          <Link to="/register" className="nav-btn nav-btn-primary hero-btn">
            Get Started
          </Link>
          <Link to="/login" className="nav-btn nav-btn-purple hero-btn">
            Log In
          </Link>
        </div>
      </main>

      {/* Features Grid */}
      <section className="home-features" aria-label="Features">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">1</div>
            <h3 className="feature-title">Tap Yes</h3>
            <p className="feature-desc">
              Get a daily prompt. Simply say "Yes" to playing sports today, and we handle the rest.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">2</div>
            <h3 className="feature-title">Get Matched</h3>
            <p className="feature-desc">
              Our smart AI pairs you with compatible players nearby based on your skill and interests.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">3</div>
            <h3 className="feature-title">Show Up & Move</h3>
            <p className="feature-desc">
              We find the venue and assign a captain. All you have to do is show up and play.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <p>&copy; {new Date().getFullYear()} ShowUp2Move. All rights reserved.</p>
      </footer>
    </div>
  );
}
