import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setToken } from '../services/api';
import { Spinner } from '../components/ui';

/**
 * OAuth callback page.
 * The backend redirects here after a successful Google OAuth flow with
 * `?token=<jwt>`. This page stores the token and redirects to the dashboard.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setToken(token);
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/login?error=oauth_failed', { replace: true });
    }
  }, [navigate, searchParams]);

  return <Spinner centered label="Completing sign-in…" />;
}
