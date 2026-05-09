import { useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card } from '../components/ui';
import { auth } from '../services/api';
import './AuthPage.css';

/**
 * Password reset confirmation page.
 * Reads the reset token from the URL query param `?token=`.
 * Requirements: 1.8
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError(t('auth.register.errors.weakPassword'));
      return;
    }

    setLoading(true);
    try {
      await auth.confirmPasswordReset(token, newPassword);
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      const apiErr = err as Error & { code?: string };
      if (apiErr.code === 'reset_token_expired') {
        setError(t('auth.passwordReset.errors.tokenExpired'));
      } else {
        setError(t('auth.passwordReset.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-page__container">
          <Card padding="lg">
            <p className="auth-page__error" role="alert">
              {t('auth.passwordReset.errors.tokenExpired')}
            </p>
            <Link to="/forgot-password">{t('auth.passwordReset.submit')}</Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-page__container">
        <div className="auth-page__header">
          <span className="auth-page__logo" aria-hidden="true">🏃</span>
          <h1 className="auth-page__title">{t('auth.passwordReset.confirmTitle')}</h1>
        </div>

        <Card padding="lg">
          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-page__fields">
              <Input
                label={t('auth.passwordReset.newPassword')}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
              {t('auth.passwordReset.confirmSubmit')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
