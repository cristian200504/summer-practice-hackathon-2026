import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { withTransaction } from '../infrastructure/database';
import { Profile, SkillLevel } from '../types';
import {
  findProfileByUserId,
  createProfile,
  updateProfile,
  findUserSports,
  replaceUserSports,
  findInvalidSportId,
} from '../repositories/profileRepository';
import { env } from '../config/env';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_BIO_LENGTH = 300;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const THUMBNAIL_SIZE = 200; // 200×200 px

const ACCEPTED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProfileInput {
  displayName: string;
  bio?: string;
  sports?: Array<{ sportId: string; skillLevel?: SkillLevel }>;
}

export interface ProfileWithSports extends Profile {
  sports: Array<{
    sportId: string;
    sportName: string;
    skillLevel: SkillLevel | null;
  }>;
}

// ── Custom errors ────────────────────────────────────────────────────────────

export class ProfileError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ProfileError';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate bio length. Throws ProfileError if bio exceeds 300 characters.
 */
function validateBio(bio: string): void {
  if (bio.length > MAX_BIO_LENGTH) {
    throw new ProfileError(
      'bio_too_long',
      `Bio must be ${MAX_BIO_LENGTH} characters or fewer.`,
      400,
      { maxLength: MAX_BIO_LENGTH, actualLength: bio.length },
    );
  }
}

/**
 * Determine whether a profile is complete:
 * display name is set AND at least one sport is selected.
 */
export function isComplete(displayName: string, sportCount: number): boolean {
  return displayName.trim().length > 0 && sportCount >= 1;
}

// ── ProfileService ───────────────────────────────────────────────────────────

/**
 * Create a new profile for the given user.
 *
 * - displayName is required (non-empty).
 * - bio is optional; if provided, must be ≤ 300 characters.
 * - sports is optional; if provided, each sportId must exist.
 * - Profile is marked complete when displayName is set AND ≥1 sport is provided.
 *
 * Throws ProfileError with code "profile_already_exists" if the user already
 * has a profile.
 * Throws ProfileError with code "bio_too_long" if bio exceeds 300 chars.
 * Throws ProfileError with code "invalid_sport_id" if a sport ID is not found.
 */
export async function createUserProfile(
  userId: string,
  data: ProfileInput,
): Promise<ProfileWithSports> {
  const bio = data.bio ?? '';
  validateBio(bio);

  // Check for existing profile
  const existing = await findProfileByUserId(userId);
  if (existing) {
    throw new ProfileError(
      'profile_already_exists',
      'A profile already exists for this user.',
      409,
    );
  }

  const sports = data.sports ?? [];

  // Validate sport IDs if provided
  if (sports.length > 0) {
    const invalidId = await findInvalidSportId(sports.map((s) => s.sportId));
    if (invalidId) {
      throw new ProfileError('invalid_sport_id', `Sport ID not found: ${invalidId}`, 400, {
        sportId: invalidId,
      });
    }
  }

  const complete = isComplete(data.displayName, sports.length);

  return withTransaction(async (client) => {
    const profile = await createProfile(userId, data.displayName, bio, complete, client);

    if (sports.length > 0) {
      await replaceUserSports(userId, sports, client);
    }

    const userSports = await findUserSports(userId);

    // Trigger NLP analysis asynchronously (fire-and-forget, Req 3.1)
    if (bio.trim()) {
      import('../services/aiEnrichmentService').then(({ suggestSportsFromBio }) =>
        suggestSportsFromBio(bio, userId).catch(() => {}),
      ).catch(() => {});
    }

    return {
      ...profile,
      sports: userSports.map(({ userSport, sport }) => ({
        sportId: sport.id,
        sportName: sport.name,
        skillLevel: userSport.skillLevel,
      })),
    };
  });
}

/**
 * Update an existing profile for the given user.
 *
 * - Only provided fields are updated.
 * - bio, if provided, must be ≤ 300 characters.
 * - sports, if provided, replaces the full sports list.
 * - isComplete is recomputed after every update.
 * - Changes are persisted immediately.
 *
 * Throws ProfileError with code "profile_not_found" if no profile exists.
 * Throws ProfileError with code "bio_too_long" if bio exceeds 300 chars.
 * Throws ProfileError with code "invalid_sport_id" if a sport ID is not found.
 */
export async function updateUserProfile(
  userId: string,
  data: Partial<ProfileInput>,
): Promise<ProfileWithSports> {
  if (data.bio !== undefined) {
    validateBio(data.bio);
  }

  const existing = await findProfileByUserId(userId);
  if (!existing) {
    throw new ProfileError('profile_not_found', 'Profile not found.', 404);
  }

  const sports = data.sports;

  // Validate sport IDs if provided
  if (sports !== undefined && sports.length > 0) {
    const invalidId = await findInvalidSportId(sports.map((s) => s.sportId));
    if (invalidId) {
      throw new ProfileError('invalid_sport_id', `Sport ID not found: ${invalidId}`, 400, {
        sportId: invalidId,
      });
    }
  }

  return withTransaction(async (client) => {
    // Replace sports if provided
    if (sports !== undefined) {
      await replaceUserSports(userId, sports, client);
    }

    // Determine the new sport count for completeness check
    const currentSports = await findUserSports(userId);
    const sportCount = currentSports.length;

    // Determine the effective display name for completeness check
    const effectiveDisplayName = data.displayName ?? existing.displayName;
    const complete = isComplete(effectiveDisplayName, sportCount);

    const updateFields: Parameters<typeof updateProfile>[1] = {
      isComplete: complete,
    };
    if (data.displayName !== undefined) updateFields.displayName = data.displayName;
    if (data.bio !== undefined) updateFields.bio = data.bio;

    const updated = await updateProfile(userId, updateFields, client);
    if (!updated) {
      throw new ProfileError('profile_not_found', 'Profile not found.', 404);
    }

    return {
      ...updated,
      sports: currentSports.map(({ userSport, sport }) => ({
        sportId: sport.id,
        sportName: sport.name,
        skillLevel: userSport.skillLevel,
      })),
    };
  });
}

/**
 * Fetch a profile with its sports and skill levels.
 *
 * Throws ProfileError with code "profile_not_found" if no profile exists.
 */
export async function getUserProfile(userId: string): Promise<ProfileWithSports> {
  const profile = await findProfileByUserId(userId);
  if (!profile) {
    throw new ProfileError('profile_not_found', 'Profile not found.', 404);
  }

  const userSports = await findUserSports(userId);
  return {
    ...profile,
    sports: userSports.map(({ userSport, sport }) => ({
      sportId: sport.id,
      sportName: sport.name,
      skillLevel: userSport.skillLevel,
    })),
  };
}

/**
 * Upload a profile photo for the given user.
 *
 * - Validates MIME type (JPEG, PNG, WebP only).
 * - Validates file size (≤ 5 MB).
 * - Resizes and stores a 200×200 thumbnail alongside the original.
 * - Stores file references in the profiles table.
 * - Returns the public URLs for the original and thumbnail.
 *
 * Throws ProfileError with code "invalid_photo_format" for unsupported MIME types.
 * Throws ProfileError with code "photo_too_large" if file exceeds 5 MB.
 * Throws ProfileError with code "profile_not_found" if no profile exists.
 *
 * Requirements: 2.4, 2.5
 */
export async function uploadPhoto(
  userId: string,
  file: Buffer,
  mimeType: string,
): Promise<{ url: string; thumbnailUrl: string }> {
  // Validate MIME type
  const ext = ACCEPTED_MIME_TYPES[mimeType];
  if (!ext) {
    throw new ProfileError(
      'invalid_photo_format',
      'Unsupported photo format. Please upload a JPEG, PNG, or WebP image.',
      400,
      { accepted: ['jpeg', 'png', 'webp'] },
    );
  }

  // Validate file size
  if (file.length > MAX_PHOTO_BYTES) {
    throw new ProfileError(
      'photo_too_large',
      `Photo must be ${MAX_PHOTO_BYTES} bytes or smaller.`,
      400,
      { maxBytes: MAX_PHOTO_BYTES },
    );
  }

  // Ensure the profile exists
  const existing = await findProfileByUserId(userId);
  if (!existing) {
    throw new ProfileError('profile_not_found', 'Profile not found.', 404);
  }

  // Build file paths
  const uploadDir = env.UPLOAD_DIR;
  const originalsDir = path.join(uploadDir, 'originals');
  const thumbnailsDir = path.join(uploadDir, 'thumbnails');

  // Ensure directories exist
  fs.mkdirSync(originalsDir, { recursive: true });
  fs.mkdirSync(thumbnailsDir, { recursive: true });

  const timestamp = Date.now();
  const filename = `${userId}-${timestamp}.${ext}`;
  const originalPath = path.join(originalsDir, filename);
  const thumbnailPath = path.join(thumbnailsDir, filename);

  // Write original file
  fs.writeFileSync(originalPath, file);

  // Generate and write thumbnail (200×200, cover crop)
  await sharp(file)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
    .toFile(thumbnailPath);

  // Build public URLs
  const url = `/uploads/originals/${filename}`;
  const thumbnailUrl = `/uploads/thumbnails/${filename}`;

  // Persist URLs in the profiles table
  await updateProfile(userId, { photoUrl: url, thumbnailUrl });

  // Trigger vision AI analysis asynchronously (fire-and-forget, Req 3.2)
  import('../services/aiEnrichmentService').then(({ suggestSportsFromPhoto }) =>
    suggestSportsFromPhoto(url, userId).catch(() => {}),
  ).catch(() => {});

  return { url, thumbnailUrl };
}
