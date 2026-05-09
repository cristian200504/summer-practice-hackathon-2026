import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Badge, Spinner, Button } from '../components/ui';
import CaptainDashboard from '../components/CaptainDashboard';
import VenueSuggestions from '../components/VenueSuggestions';
import TeamBalancingView from '../components/TeamBalancingView';
import AddToCalendarButton from '../components/AddToCalendarButton';
import ShareEventButton from '../components/ShareEventButton';
import { events, sports, EventData, Sport, getStoredUserId } from '../services/api';
import './EventDetailPage.css';

/**
 * Event detail screen — wires together all event coordination components.
 *
 * - Match confirmation card (if group is Pending)
 * - Captain dashboard (if user is captain)
 * - Venue suggestions with weather
 * - Team composition
 * - Add to Calendar / Share buttons
 *
 * Requirements: 11.4, 20.2
 */
export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const userId = getStoredUserId();

  const [event, setEvent] = useState<EventData | null>(null);
  const [sport, setSport] = useState<Sport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const [eventData, sportList] = await Promise.all([
          events.get(id!),
          sports.list(),
        ]);
        if (cancelled) return;
        setEvent(eventData);
        setSport(sportList.find((s) => s.id === eventData.sportId) ?? null);

        // If opened via share link and user is logged in, add to join queue
        const shareToken = searchParams.get('share');
        if (shareToken && userId) {
          await events.respondToInvite(id!, true).catch(() => {});
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [id, userId, searchParams]);

  if (loading) return <main className="event-detail"><Spinner centered /></main>;
  if (!event) return <main className="event-detail"><p>{t('errors.notFound')}</p></main>;

  const isCaptain = event.captainUserId === userId;
  const isActive = event.state === 'Active';

  return (
    <main className="event-detail">
      {/* Header */}
      <div className="event-detail__header">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          ← {t('common.back')}
        </Button>
        <div className="event-detail__title-row">
          <h1 className="event-detail__title">{event.title}</h1>
          <Badge variant={isActive ? 'success' : 'default'}>{event.state}</Badge>
        </div>
        {sport && <Badge variant="primary">{sport.name}</Badge>}
      </div>

      {/* Event meta */}
      <Card padding="md" className="event-detail__meta-card">
        <dl className="event-detail__meta">
          <div>
            <dt>🕐 {t('events.detail.time')}</dt>
            <dd>{new Date(event.startTime).toLocaleString()}</dd>
          </div>
          {event.venueName && (
            <div>
              <dt>📍 {t('events.detail.venue')}</dt>
              <dd>{event.venueName}{event.venueAddress ? ` — ${event.venueAddress}` : ''}</dd>
            </div>
          )}
          <div>
            <dt>👥 {t('events.detail.participants')}</dt>
            <dd>{event.minParticipants}–{event.maxParticipants} players</dd>
          </div>
          {isCaptain && (
            <div>
              <dt>👑 {t('events.detail.captain')}</dt>
              <dd>You</dd>
            </div>
          )}
        </dl>

        {/* Action buttons */}
        <div className="event-detail__actions">
          {isActive && <AddToCalendarButton eventId={event.id} eventTitle={event.title} />}
          <ShareEventButton eventId={event.id} eventTitle={event.title} />
          {event.venueName && event.venueAddress && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.venueAddress!)}`,
                '_blank', 'noopener',
              )}
              aria-label={t('events.detail.getDirections')}
            >
              🗺️ {t('events.detail.getDirections')}
            </Button>
          )}
        </div>
      </Card>

      {/* Captain dashboard */}
      {isCaptain && isActive && (
        <CaptainDashboard
          groupId={event.id}
          isCaptain={true}
          onSuggestVenue={() => {}}
          onInitiatePoll={() => navigate(`/chat/${event.id}`)}
          onSetTime={() => {}}
          onSendAnnouncement={() => navigate(`/chat/${event.id}`)}
        />
      )}

      {/* Venue suggestions (captain only, active events) */}
      {isCaptain && isActive && sport && (
        <section aria-label="Venue suggestions">
          <h2 className="event-detail__section-title">Venue Suggestions</h2>
          <VenueSuggestions
            sportName={sport.name}
            lat={48.8566}
            lng={2.3522}
            eventDatetime={event.startTime}
          />
        </section>
      )}

      {/* Team composition (team sports only) */}
      {isActive && sport?.isTeamSport && (
        <section aria-label="Team composition">
          <h2 className="event-detail__section-title">Teams</h2>
          <TeamBalancingView groupId={event.id} isCaptain={isCaptain} />
        </section>
      )}

      {/* Chat link */}
      {isActive && (
        <Button
          variant="primary"
          fullWidth
          onClick={() => navigate(`/chat/${event.id}`)}
          aria-label="Open group chat"
        >
          💬 Open Group Chat
        </Button>
      )}
    </main>
  );
}
