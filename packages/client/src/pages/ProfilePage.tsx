import { useState, useEffect, useRef, useCallback, DragEvent, ChangeEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card, Badge, Avatar, Spinner, ToastContainer, useToast } from '../components/ui';
import { profiles, sports as sportsApi, achievements as achievementsApi, getStoredUserId } from '../services/api';
import type { Sport, Achievement } from '../services/api';
import './ProfilePage.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced';

interface SelectedSport {
  sportId: string;
  skillLevel: SkillLevel | '';
}

interface ProfileData {
  displayName: string;
  bio: string;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  sports: Array<{ sportId: string; sportName: string; skillLevel: SkillLevel | null }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_BIO_LENGTH = 300;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SKILL_LEVELS: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function validatePhotoFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) return 'invalidFormat';
  if (file.size > MAX_PHOTO_BYTES) return 'tooLarge';
  return null;
}

/**
 * Profile creation and editing page.
 *
 * Features:
 * - Display name input (required)
 * - Bio textarea with live character counter (max 300)
 * - Sports multi-select with per-sport skill level dropdowns
 * - Photo upload with drag-and-drop, format/size validation, thumbnail preview
 * - Earned achievement badges
 * - Saves via profiles.create or profiles.update depending on whether a profile exists
 *
 * Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 16.3
 */
export default function ProfilePage() {
  const { t } = useTranslation();
  const { toasts, addToast, dismissToast } = useToast();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const userId = getStoredUserId();

  // ── Remote data ───────────────────────────────────────────────────────────
  const [allSports, setAllSports] = useState<Sport[]>([]);
  const [earnedAchievements, setEarnedAchievements] = useState<Achievement[]>([]);
  const [profileExists, setProfileExists] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // ── Form state ────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedSports, setSelectedSports] = useState<SelectedSport[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Photo state ───────────────────────────────────────────────────────────
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load initial data ─────────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      setPageLoading(true);
      try {
        // Load sports list and profile in parallel; achievements separately (may not exist yet)
        const [sportsResult] = await Promise.all([sportsApi.list()]);
        setAllSports(sportsResult);

        if (userId) {
          // Try to load existing profile
          try {
            const profile = await profiles.get(userId) as ProfileData;
            setProfileExists(true);
            setDisplayName(profile.displayName ?? '');
            setBio(profile.bio ?? '');
            setPhotoPreview(profile.thumbnailUrl ?? profile.photoUrl ?? null);
            setSelectedSports(
              (profile.sports ?? []).map((s) => ({
                sportId: s.sportId,
                skillLevel: (s.skillLevel ?? '') as SkillLevel | '',
              })),
            );
          } catch (err: unknown) {
            // 404 means no profile yet — that's fine
            const apiErr = err as { status?: number };
            if (apiErr?.status !== 404) {
              addToast({ message: t('profile.errors.generic'), variant: 'error' });
            }
          }

          // Load achievements (best-effort — endpoint may not be wired yet)
          try {
            const ach = await achievementsApi.getForUser(userId);
            setEarnedAchievements(ach);
          } catch {
            // Achievements endpoint not yet available — silently skip
          }
        }
      } catch {
        addToast({ message: t('errors.generic'), variant: 'error' });
      } finally {
        setPageLoading(false);
      }
    }

    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Sport selection ───────────────────────────────────────────────────────

  function isSportSelected(sportId: string): boolean {
    return selectedSports.some((s) => s.sportId === sportId);
  }

  function toggleSport(sportId: string) {
    setSelectedSports((prev) => {
      if (prev.some((s) => s.sportId === sportId)) {
        return prev.filter((s) => s.sportId !== sportId);
      }
      return [...prev, { sportId, skillLevel: '' }];
    });
  }

  function setSkillLevel(sportId: string, level: SkillLevel | '') {
    setSelectedSports((prev) =>
      prev.map((s) => (s.sportId === sportId ? { ...s, skillLevel: level } : s)),
    );
  }

  // ── Photo handling ────────────────────────────────────────────────────────

  function handlePhotoFile(file: File) {
    setPhotoError('');
    const err = validatePhotoFile(file);
    if (err) {
      setPhotoError(t(`profile.photo.errors.${err}`));
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handlePhotoFile(file);
    // Reset input so the same file can be re-selected after an error
    e.target.value = '';
  }

  function handleDropZoneClick() {
    fileInputRef.current?.click();
  }

  function handleDropZoneKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePhotoFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Form submission ───────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!displayName.trim()) {
      setFormError(t('profile.errors.displayNameRequired'));
      return;
    }
    if (bio.length > MAX_BIO_LENGTH) {
      setFormError(t('profile.errors.bioTooLong'));
      return;
    }
    if (!userId) {
      setFormError(t('profile.errors.generic'));
      return;
    }

    setSaving(true);
    try {
      const sportsPayload = selectedSports.map((s) => ({
        sportId: s.sportId,
        skillLevel: s.skillLevel || undefined,
      }));

      if (profileExists) {
        await profiles.update(userId, {
          displayName: displayName.trim(),
          bio,
          sports: sportsPayload,
        });
      } else {
        await profiles.create({
          displayName: displayName.trim(),
          bio,
          sports: sportsPayload,
        });
        setProfileExists(true);
      }

      // Upload photo if a new one was selected
      if (photoFile) {
        setPhotoUploading(true);
        try {
          const result = await profiles.uploadPhoto(userId, photoFile);
          setPhotoPreview(result.thumbnailUrl ?? result.url);
          setPhotoFile(null);
        } catch {
          addToast({ message: t('profile.photo.errors.generic'), variant: 'error' });
        } finally {
          setPhotoUploading(false);
        }
      }

      addToast({ message: t('profile.saved'), variant: 'success' });
    } catch (err: unknown) {
      const apiErr = err as { code?: string; message?: string };
      if (apiErr?.code === 'bio_too_long') {
        setFormError(t('profile.errors.bioTooLong'));
      } else {
        setFormError(t('profile.errors.generic'));
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <main className="profile-page profile-page--loading" aria-label={t('profile.title')}>
        <Spinner size="lg" />
        <span className="sr-only">{t('common.loading')}</span>
      </main>
    );
  }

  return (
    <main className="profile-page" aria-label={t('profile.title')}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="profile-page__container">
        <div className="page-hero">
          <span className="page-hero__icon" aria-hidden="true">👤</span>
          <h1 className="page-hero__title">{t('profile.title')}</h1>
          <p className="page-hero__subtitle">Set up your sports profile and let the right teammates find you.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate aria-label={t('profile.title')}>
          {/* ── Photo upload ─────────────────────────────────────────────── */}
          <Card className="profile-page__section">
            <h2 className="profile-page__section-title">{t('profile.photo.upload')}</h2>

            <div className="profile-page__photo-row">
              {/* Current photo preview */}
              <Avatar
                src={photoPreview}
                alt={displayName || t('profile.title')}
                size="xl"
                className="profile-page__avatar"
              />

              {/* Drop zone */}
              <div
                className={`profile-page__drop-zone${isDragOver ? ' profile-page__drop-zone--active' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={t('profile.photo.dragDrop')}
                onClick={handleDropZoneClick}
                onKeyDown={handleDropZoneKeyDown}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <span className="profile-page__drop-icon" aria-hidden="true">📷</span>
                <span className="profile-page__drop-text">{t('profile.photo.dragDrop')}</span>
                <span className="profile-page__drop-hint">{t('profile.photo.formats')}</span>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label={t('profile.photo.upload')}
                onChange={handleFileInputChange}
                tabIndex={-1}
              />
            </div>

            {/* Photo error */}
            {photoError && (
              <p className="profile-page__photo-error" role="alert">
                {photoError}
              </p>
            )}

            {/* Uploading indicator */}
            {photoUploading && (
              <div className="profile-page__photo-uploading" aria-live="polite">
                <Spinner size="sm" />
                <span className="sr-only">{t('common.loading')}</span>
              </div>
            )}
          </Card>

          {/* ── Basic info ───────────────────────────────────────────────── */}
          <Card className="profile-page__section">
            <h2 className="profile-page__section-title">{t('profile.title')}</h2>

            <div className="profile-page__fields">
              <Input
                label={t('profile.displayName')}
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoComplete="name"
                disabled={saving}
                maxLength={100}
              />

              {/* Bio with live character counter */}
              <div className="profile-page__bio-field">
                <label htmlFor="profile-bio" className="profile-page__bio-label">
                  {t('profile.bio')}
                </label>
                <textarea
                  id="profile-bio"
                  className={`profile-page__bio-textarea${bio.length > MAX_BIO_LENGTH ? ' profile-page__bio-textarea--error' : ''}`}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('profile.bioPlaceholder')}
                  rows={4}
                  disabled={saving}
                  aria-describedby="profile-bio-counter"
                  aria-invalid={bio.length > MAX_BIO_LENGTH ? 'true' : undefined}
                />
                <div
                  id="profile-bio-counter"
                  className={`profile-page__bio-counter${bio.length > MAX_BIO_LENGTH ? ' profile-page__bio-counter--over' : ''}`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {t('profile.bioCounter', { count: bio.length })}
                </div>
              </div>
            </div>
          </Card>

          {/* ── Sports selection ─────────────────────────────────────────── */}
          <Card className="profile-page__section">
            <h2 className="profile-page__section-title">{t('profile.sports')}</h2>

            {allSports.length === 0 ? (
              <p className="profile-page__no-sports">{t('common.loading')}</p>
            ) : (
              <ul className="profile-page__sports-list" role="list">
                {allSports.map((sport) => {
                  const selected = isSportSelected(sport.id);
                  const entry = selectedSports.find((s) => s.sportId === sport.id);
                  const checkboxId = `sport-${sport.id}`;
                  const selectId = `skill-${sport.id}`;

                  return (
                    <li key={sport.id} className="profile-page__sport-item">
                      <div className="profile-page__sport-row">
                        {/* Sport checkbox */}
                        <input
                          type="checkbox"
                          id={checkboxId}
                          className="profile-page__sport-checkbox"
                          checked={selected}
                          onChange={() => toggleSport(sport.id)}
                          disabled={saving}
                          aria-label={sport.name}
                        />
                        <label htmlFor={checkboxId} className="profile-page__sport-label">
                          {sport.name}
                        </label>

                        {/* Skill level dropdown — only shown when sport is selected */}
                        {selected && (
                          <div className="profile-page__skill-wrapper">
                            <label htmlFor={selectId} className="sr-only">
                              {t('profile.skillLevel')} — {sport.name}
                            </label>
                            <select
                              id={selectId}
                              className="profile-page__skill-select"
                              value={entry?.skillLevel ?? ''}
                              onChange={(e) => setSkillLevel(sport.id, e.target.value as SkillLevel | '')}
                              disabled={saving}
                              aria-label={`${t('profile.skillLevel')} — ${sport.name}`}
                            >
                              <option value="">{t('profile.skillLevel')}</option>
                              {SKILL_LEVELS.map((level) => (
                                <option key={level} value={level}>
                                  {t(`profile.skillLevels.${level}`)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* ── Form error ───────────────────────────────────────────────── */}
          {formError && (
            <p className="profile-page__form-error" role="alert">
              {formError}
            </p>
          )}

          {/* ── Save button ──────────────────────────────────────────────── */}
          <div className="profile-page__actions">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={saving || photoUploading}
              disabled={bio.length > MAX_BIO_LENGTH}
            >
              {t('profile.save')}
            </Button>
          </div>
        </form>

        {/* ── Achievements ─────────────────────────────────────────────── */}
        {earnedAchievements.length > 0 && (
          <section className="profile-page__achievements" aria-label={t('achievements.title')}>
            <h2 className="profile-page__section-title">{t('achievements.title')}</h2>
            <ul className="profile-page__badges-list" role="list">
              {earnedAchievements.map((ach) => (
                <li key={ach.id} className="profile-page__badge-item">
                  <Badge
                    variant="primary"
                    className="profile-page__badge"
                    title={ach.description}
                    aria-label={ach.title}
                  >
                    {ach.iconUrl ? (
                      <img
                        src={ach.iconUrl}
                        alt=""
                        className="profile-page__badge-icon"
                        aria-hidden="true"
                        width={16}
                        height={16}
                      />
                    ) : (
                      <span className="profile-page__badge-emoji" aria-hidden="true">🏅</span>
                    )}
                    {ach.title}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
