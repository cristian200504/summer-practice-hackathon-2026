import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card } from '../components/ui';
import { auth, setToken } from '../services/api';
import './AuthPage.css';

/**
 * Login page.
 *
 * - Email + password form with inline validation.
 * - Generic error display — no field disclosure (Req 1.6).
 * - "Continue with Google" OAuth button (Req 1.2).
 * - Links to register and password reset.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
 */
export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!email.trim()) {
      setError(t('auth.login.errors.invalidCredentials'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.login.errors.invalidCredentials'));
      return;
    }

    setLoading(true);
    try {
      const { token } = await auth.login(email.trim().toLowerCase(), password);
      setToken(token);
      navigate('/dashboard', { replace: true });
    } catch {
      // Generic error — no field disclosure (Req 1.6)
      setError(t('auth.login.errors.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    // Redirect to backend OAuth initiation endpoint
    window.location.href = '/api/auth/google';
  }

  return (
    <div className="auth-page">
      <div className="auth-page__container">
        <div className="auth-page__header">
          <span className="auth-page__logo" aria-hidden="true">🏃</span>
          <h1 className="auth-page__title">{t('auth.login.title')}</h1>
          <p className="auth-page__subtitle">{t('auth.login.subtitle')}</p>
        </div>

        <Card padding="lg">
          {/* Google OAuth button */}
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={handleGoogleLogin}
            className="auth-page__oauth-btn"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt=""
              width={18}
              height={18}
              aria-hidden="true"
            />
            {t('auth.login.continueWithGoogle')}
          </Button>

          <div className="auth-page__divider" aria-hidden="true">
            <span>{t('common.or')}</span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-page__fields">
              <Input
                label={t('auth.login.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={loading}
              />
              <Input
                label={t('auth.login.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>

            {/* Generic error — no field disclosure (Req 1.6) */}
            {error && (
              <p className="auth-page__error" role="alert">
                {error}
              </p>
            )}

            <div className="auth-page__forgot">
              <Link to="/forgot-password">{t('auth.login.forgotPassword')}</Link>
            </div>

            <Button type="submit" fullWidth loading={loading}>
              {t('auth.login.submit')}
            </Button>
          </form>
        </Card>

        <p className="auth-page__switch">
          {t('auth.login.noAccount')}{' '}
          <Link to="/register">{t('auth.login.signUp')}</Link>
        </p>
      </div>
    </div>
  );
}
