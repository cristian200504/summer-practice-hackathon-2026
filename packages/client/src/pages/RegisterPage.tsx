import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card } from '../components/ui';
import { auth, setToken } from '../services/api';
import './AuthPage.css';

/**
 * Registration page.
 *
 * - Email + password (≥ 8 chars) + display name form with inline validation.
 * - Descriptive error for duplicate email (Req 1.4).
 * - "Continue with Google" OAuth button (Req 1.2).
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.8
 */
export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(t('auth.register.errors.generic'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.register.errors.weakPassword'));
      return;
    }

    setLoading(true);
    try {
      const { token } = await auth.register(email.trim().toLowerCase(), password);
      setToken(token);
      // Redirect to profile creation after registration
      navigate('/profile', { replace: true });
    } catch (err) {
      const apiErr = err as Error & { code?: string };
      if (apiErr.code === 'email_in_use') {
        setError(t('auth.register.errors.emailInUse'));
      } else {
        setError(t('auth.register.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    window.location.href = '/api/auth/google';
  }

  return (
    <div className="auth-page">
      <div className="auth-page__container">
        <div className="auth-page__header">
          <span className="auth-page__logo" aria-hidden="true">🏃</span>
          <h1 className="auth-page__title">{t('auth.register.title')}</h1>
          <p className="auth-page__subtitle">{t('auth.register.subtitle')}</p>
        </div>

        <Card padding="lg">
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
            {t('auth.register.continueWithGoogle')}
          </Button>

          <div className="auth-page__divider" aria-hidden="true">
            <span>{t('common.or')}</span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-page__fields">
              <Input
                label={t('auth.register.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={loading}
              />
              <Input
                label={t('auth.register.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                hint={t('auth.register.passwordHint')}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <p className="auth-page__error" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth loading={loading}>
              {t('auth.register.submit')}
            </Button>
          </form>
        </Card>

        <p className="auth-page__switch">
          {t('auth.register.haveAccount')}{' '}
          <Link to="/login">{t('auth.register.logIn')}</Link>
        </p>
      </div>
    </div>
  );
}
