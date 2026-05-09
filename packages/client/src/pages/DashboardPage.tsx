import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AvailabilityPrompt from '../components/AvailabilityPrompt';
import ChatbotWidget from '../components/ChatbotWidget';
import DmWidget from '../components/DmWidget';
import { Avatar, Card, Badge } from '../components/ui';
import { compatibility, getStoredUserId, Recommendation } from '../services/api';
import './DashboardPage.css';

/**
 * Dashboard — the user's home screen after login.
 *
 * - Availability prompt at the top (single-tap, Req 4.2).
 * - Smart teammate recommendations below (Req 3.6).
 *
 * Requirements: 4.2, 3.6
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const userId = getStoredUserId();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    if (!userId) return;
    compatibility.getRecommendations(userId)
      .then(setRecommendations)
      .catch(() => {});
  }, [userId]);

  return (
    <main className="dashboard-page">
      <div className="page-hero">
        <span className="page-hero__icon" aria-hidden="true">🏃</span>
        <h1 className="page-hero__title">{t('dashboard.title')}</h1>
        <p className="page-hero__subtitle">Your sports hub — availability, teammates, and messages in one place.</p>
      </div>

      {/* Availability prompt — always first (Req 4.2) */}
      <section className="dashboard-page__availability" aria-label={t('availability.prompt')}>
        <AvailabilityPrompt />
      </section>

      {/* Smart teammate recommendations (Req 3.6) */}
      {recommendations.length > 0 && (
        <section className="dashboard-page__recommendations" aria-label={t('dashboard.recommendations')}>
          <h2 className="dashboard-page__section-title">{t('dashboard.recommendations')}</h2>
          <ul className="dashboard-page__rec-list" role="list">
            {recommendations.map((rec) => (
              <li key={rec.userId}>
                <Card className="dashboard-page__rec-card" padding="sm">
                  <Avatar src={rec.thumbnailUrl} alt={rec.displayName} size="md" />
                  <div className="dashboard-page__rec-info">
                    <span className="dashboard-page__rec-name">{rec.displayName}</span>
                    <Badge variant="primary" className="dashboard-page__rec-score">
                      {Math.round(rec.score * 100)}% match
                    </Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Direct Messages widget */}
      <section className="dashboard-page__messages" aria-label="Direct messages">
        <DmWidget />
      </section>

      {/* AI Sports Assistant chatbot — floating widget (g4f powered) */}
      <ChatbotWidget />
    </main>
  );
}
