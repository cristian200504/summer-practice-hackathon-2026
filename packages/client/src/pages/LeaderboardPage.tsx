import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Badge, Card, Spinner } from '../components/ui';
import { leaderboard, sports, LeaderboardEntry, Sport } from '../services/api';
import './LeaderboardPage.css';

/**
 * Leaderboard screen — ranks users by total achievement count.
 * Filterable by sport.
 * Requirements: 16.4
 */
export default function LeaderboardPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [sportList, setSportList] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sports.list().then(setSportList).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    leaderboard.get(selectedSport || undefined)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedSport]);

  return (
    <main className="leaderboard-page">
      <h1 className="leaderboard-page__title">{t('leaderboard.title')}</h1>

      <div className="leaderboard-page__filter">
        <label htmlFor="lb-sport" className="leaderboard-page__filter-label">
          {t('leaderboard.filterBySport')}
        </label>
        <select
          id="lb-sport"
          className="leaderboard-page__filter-select"
          value={selectedSport}
          onChange={(e) => setSelectedSport(e.target.value)}
        >
          <option value="">All sports</option>
          {sportList.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading ? <Spinner centered /> : (
        <ol className="leaderboard-page__list" role="list">
          {entries.map((entry, index) => (
            <li key={entry.userId} className="leaderboard-page__entry">
              <Card padding="sm" className="leaderboard-page__card">
                <span className="leaderboard-page__rank" aria-label={`Rank ${index + 1}`}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </span>
                <Avatar src={entry.thumbnailUrl} alt={entry.displayName} size="md" />
                <span className="leaderboard-page__name">{entry.displayName}</span>
                <Badge variant="primary" className="leaderboard-page__count">
                  {entry.achievementCount} 🏅
                </Badge>
              </Card>
            </li>
          ))}
          {entries.length === 0 && (
            <li className="leaderboard-page__empty">No entries yet.</li>
          )}
        </ol>
      )}
    </main>
  );
}
