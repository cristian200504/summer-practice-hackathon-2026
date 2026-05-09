import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Badge, Input, Spinner, Modal } from '../components/ui';
import { events, sports, EventData, Sport } from '../services/api';
import EventMap from '../components/EventMap';
import './EventsPage.css';

/**
 * Public event listing with sport filter and event creation modal.
 * Requirements: 10.1, 10.2, 10.8
 */
export default function EventsPage() {
  const { t } = useTranslation();
  const [eventList, setEventList] = useState<EventData[]>([]);
  const [sportList, setSportList] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    Promise.all([events.list(), sports.list()])
      .then(([evts, spts]) => { setEventList(evts); setSportList(spts); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = selectedSport
    ? eventList.filter((e) => e.sportId === selectedSport)
    : eventList;

  return (
    <main className="events-page">
      <div className="events-page__header">
        <h1 className="events-page__title">{t('events.title')}</h1>
        <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
          + {t('events.create')}
        </Button>
      </div>

      {/* Filters and Controls */}
      <div className="events-page__filters" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <select
          className="events-page__filter-select"
          value={selectedSport}
          onChange={(e) => setSelectedSport(e.target.value)}
          aria-label={t('events.filters.sport')}
        >
          <option value="">{t('events.filters.sport')} — All</option>
          {sportList.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button 
            variant={viewMode === 'list' ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
          <Button 
            variant={viewMode === 'map' ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setViewMode('map')}
          >
            Map
          </Button>
        </div>
      </div>

      {loading ? <Spinner centered /> : (
        filtered.length === 0 ? (
          <p className="events-page__empty">{t('events.noEvents')}</p>
        ) : (
          viewMode === 'map' ? (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <EventMap events={filtered} />
            </div>
          ) : (
            <ul className="events-page__list" role="list">
              {filtered.map((event) => (
                <li key={event.id}>
                  <Link to={`/events/${event.id}`} className="events-page__event-link">
                    <Card className="events-page__event-card" padding="md">
                      <div className="events-page__event-header">
                        <h2 className="events-page__event-title">{event.title}</h2>
                        <Badge variant={event.state === 'Active' ? 'success' : 'default'}>
                          {event.state}
                        </Badge>
                      </div>
                      <p className="events-page__event-meta">
                        🕐 {new Date(event.startTime).toLocaleString()}
                      </p>
                      {event.venueName && (
                        <p className="events-page__event-venue">📍 {event.venueName}</p>
                      )}
                      <p className="events-page__event-participants">
                        👥 {event.minParticipants}–{event.maxParticipants} players
                      </p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )
        )
      )}

      {/* Create event modal */}
      <CreateEventModal
        isOpen={showCreate}
        sportList={sportList}
        onClose={() => setShowCreate(false)}
        onCreated={(event) => { setEventList((prev) => [event, ...prev]); setShowCreate(false); }}
      />
    </main>
  );
}

// ── Create Event Modal ────────────────────────────────────────────────────────

function CreateEventModal({
  isOpen, sportList, onClose, onCreated,
}: {
  isOpen: boolean;
  sportList: Sport[];
  onClose: () => void;
  onCreated: (event: EventData) => void;
}) {
  const { t } = useTranslation();
  const [sportId, setSportId] = useState('');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [minP, setMinP] = useState('2');
  const [maxP, setMaxP] = useState('10');
  const [venueName, setVenueName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sportId || !title || !startTime) { setError('Please fill in all required fields.'); return; }
    setSaving(true);
    setError('');
    try {
      const event = await events.create({
        sportId, title, startTime: new Date(startTime).toISOString(),
        minParticipants: parseInt(minP), maxParticipants: parseInt(maxP),
        venueName: venueName || undefined, description: description || undefined,
      });
      onCreated(event);
    } catch { setError(t('errors.generic')); }
    finally { setSaving(false); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('events.create')} size="md">
      <form onSubmit={handleSubmit} noValidate>
        <div className="create-event-form">
          <div>
            <label htmlFor="ce-sport" className="create-event-form__label">Sport *</label>
            <select id="ce-sport" className="create-event-form__select" value={sportId}
              onChange={(e) => setSportId(e.target.value)} required>
              <option value="">Select sport…</option>
              {sportList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <Input label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Input label="Start time *" type="datetime-local" value={startTime}
            onChange={(e) => setStartTime(e.target.value)} required />
          <div className="create-event-form__row">
            <Input label="Min players *" type="number" value={minP}
              onChange={(e) => setMinP(e.target.value)} min={1} required />
            <Input label="Max players *" type="number" value={maxP}
              onChange={(e) => setMaxP(e.target.value)} min={1} required />
          </div>
          <Input label="Venue name" value={venueName} onChange={(e) => setVenueName(e.target.value)} />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          {error && <p className="create-event-form__error" role="alert">{error}</p>}
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            {t('events.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
