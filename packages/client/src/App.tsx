import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ThemeProvider } from './components/ThemeContext';

// Lazy-loaded route components for code splitting (Req 19.5)
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const DmChatPage = lazy(() => import('./pages/DmChatPage'));

/**
 * Loading fallback shown while lazy-loaded route chunks are fetched.
 * Provides visual feedback within 200ms (Req 19.4).
 */
function LoadingFallback() {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * Root router.
 *
 * Public routes (/, /login, /register) render without the shell layout.
 * App routes (/dashboard, /profile, /events, /chat, /discover) render
 * inside the Layout shell which provides the sidebar / bottom nav.
 *
 * All routes are lazy-loaded for code splitting (Req 19.5).
 * Renders correctly from 320px to 1440px (Req 19.1).
 */
function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* ── Public routes (no shell) ─────────────────────────────────── */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* ── App routes (inside shell layout) ────────────────────────── */}
        <Route element={<Layout />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/chat/:groupId" element={<ChatPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:username" element={<DmChatPage />} />
        </Route>

        {/* ── Catch-all redirect ───────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function AppWithProviders() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}
