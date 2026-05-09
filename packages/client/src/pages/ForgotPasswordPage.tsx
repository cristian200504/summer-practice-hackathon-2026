import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card } from '../components/ui';
import { auth } from '../services/api';
import './AuthPage.css';

/**
 * Password reset request page.
 * Always returns the same success message regardless of whether the email
 * exists — prevents email enumeration (Req 1.8).
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await auth.requestPasswordReset(email.trim().toLowerCase());
    } catch {
      // Silently ignore — always show success to prevent email enumeration
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__container">
        <div className="auth-page__header">
          <span className="auth-page__logo" aria-hidden="true">🏃</span>
          <h1 className="auth-page__title">{t('auth.passwordReset.requestTitle')}</h1>
          <p className="auth-page__subtitle">{t('auth.passwordReset.requestSubtitle')}</p>
        </div>

        <Card padding="lg">
          {submitted ? (
            <p className="auth-page__success" role="status">
              {t('auth.passwordReset.success', 'If that email is registered, a reset link has been sent.')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="auth-page__fields">
                <Input
                  label={t('auth.passwordReset.email')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" fullWidth loading={loading}>
                {t('auth.passwordReset.submit')}
              </Button>
            </form>
          )}
        </Card>

        <p className="auth-page__switch">
          <Link to="/login">{t('common.back')} {t('auth.login.title')}</Link>
        </p>
      </div>
    </div>
  );
}
