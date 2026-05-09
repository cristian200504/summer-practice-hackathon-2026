import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { availability, sports, type AvailabilityResponse, type Sport } from '../services/api';
import { Button, Card, Badge, Spinner } from './ui';
import './AvailabilityPrompt.css';

type Step = 'loading' | 'prompt' | 'sport-select' | 'status';

/**
 * Self-contained "ShowUpToday?" card for the dashboard.
 *
 * Flow:
 *  1. On mount → fetch today's response.
 *  2. No response → show Yes / No prompt (single-tap, Req 4.2).
 *  3. Tapped Yes → show sport-selection checkboxes + Confirm (Req 4.6).
 *  4. Submitted (or tapped No) → show current status + "Change response" (Req 4.7).
 *
 * Accessibility: all interactive elements are keyboard-navigable with visible
 * focus indicators (Req 19.2). Touch targets are ≥ 44×44 px (Req 19.3).
 */
export default function AvailabilityPrompt() {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('loading');
  const [response, setResponse] = useState<AvailabilityResponse | null>(null);
  const [sportList, setSportList] = useState<Sport[]>([]);
  const [selectedSportIds, setSelectedSportIds] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [todayResponse, sportData] = await Promise.all([
          availability.getToday(),
          sports.list(),
        ]);
        if (cancelled) return;
        setSportList(sportData);
        if (todayResponse) {
          setResponse(todayResponse);
          setSelectedSportIds(todayResponse.sportIds);
          setIsLocked(todayResponse.lockedForMatching);
          setStep('status');
        } else {
          setStep('prompt');
        }
      } catch {
        if (!cancelled) setStep('prompt'); // degrade gracefully
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleNo = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await availability.record(false, []);
      setResponse(res);
      setIsLocked(res.lockedForMatching);
      setStep('status');
    } catch {
      setError(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }, [t]);

  const handleYes = useCallback(() => {
    setStep('sport-select');
  }, []);

  const toggleSport = useCallback((id: string) => {
    setSelectedSportIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id],
    );
  }, []);

  const handleConfirmSports = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await availability.record(true, selectedSportIds);
      setResponse(res);
      setIsLocked(res.lockedForMatching);
      setStep('status');
    } catch {
      setError(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }, [selectedSportIds, t]);

  const handleChange = useCallback(async () => {
    if (!response) return;
    setSubmitting(true);
    setError(null);
    try {
      const newAvailable = !response.available;
      const res = await availability.update(response.id, newAvailable, response.sportIds);
      setResponse(res);
      setIsLocked(res.lockedForMatching);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === 'response_locked') {
        setIsLocked(true);
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setSubmitting(false);
    }
  }, [response, t]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <Card className="availability-prompt" aria-label={t('availability.prompt')}>
        <Spinner centered label={t('common.loading')} />
      </Card>
    );
  }

  return (
    <Card className="availability-prompt" aria-label={t('availability.prompt')}>
      {error && (
        <p className="availability-prompt__error" role="alert">
          {error}
        </p>
      )}

      {step === 'prompt' && (
        <div className="availability-prompt__prompt">
          <p className="availability-prompt__question">{t('availability.prompt')}</p>
          <div className="availability-prompt__actions">
            <Button
              variant="primary"
              size="lg"
              className="availability-prompt__btn availability-prompt__btn--yes"
              onClick={handleYes}
              disabled={submitting}
              aria-label={t('availability.yes')}
            >
              {t('availability.yes')}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="availability-prompt__btn availability-prompt__btn--no"
              onClick={handleNo}
              loading={submitting}
              disabled={submitting}
              aria-label={t('availability.no')}
            >
              {t('availability.no')}
            </Button>
          </div>
        </div>
      )}

      {step === 'sport-select' && (
        <div className="availability-prompt__sport-select">
          <p className="availability-prompt__question">{t('availability.selectSports')}</p>
          <fieldset className="availability-prompt__sports-fieldset">
            <legend className="sr-only">{t('availability.selectSports')}</legend>
            <ul className="availability-prompt__sports-list" role="list">
              {sportList.map(sport => (
                <li key={sport.id} className="availability-prompt__sport-item">
                  <label className="availability-prompt__sport-label">
                    <input
                      type="checkbox"
                      className="availability-prompt__sport-checkbox"
                      checked={selectedSportIds.includes(sport.id)}
                      onChange={() => toggleSport(sport.id)}
                    />
                    <span className="availability-prompt__sport-name">{sport.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <div className="availability-prompt__actions">
            <Button
              variant="primary"
              size="lg"
              className="availability-prompt__btn"
              onClick={handleConfirmSports}
              loading={submitting}
              disabled={submitting}
              fullWidth
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}

      {step === 'status' && response && (
        <div className="availability-prompt__status">
          <Badge
            variant={response.available ? 'success' : 'default'}
            className="availability-prompt__status-badge"
          >
            {response.available
              ? t('availability.status.available')
              : t('availability.status.unavailable')}
          </Badge>

          {response.available && response.sportIds.length > 0 && (
            <ul className="availability-prompt__selected-sports" aria-label={t('availability.selectSports')}>
              {response.sportIds.map(id => {
                const sport = sportList.find(s => s.id === id);
                return sport ? (
                  <li key={id}>
                    <Badge variant="primary" className="availability-prompt__sport-badge">
                      {sport.name}
                    </Badge>
                  </li>
                ) : null;
              })}
            </ul>
          )}

          {!isLocked && (
            <Button
              variant="ghost"
              size="sm"
              className="availability-prompt__change-btn"
              onClick={handleChange}
              loading={submitting}
              disabled={submitting}
            >
              {t('availability.change')}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
