import multer from 'multer';
import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, JwtPayload } from '../middleware/authenticate';
import {
  createUserProfile,
  updateUserProfile,
  getUserProfile,
  uploadPhoto,
  ProfileError,
} from '../services/profileService';
import { SkillLevel } from '../types';
import { env } from '../config/env';

// ── Multer configuration ─────────────────────────────────────────────────────
// Store files in memory so we can pass the buffer to sharp for processing.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const accepted = ['image/jpeg', 'image/png', 'image/webp'];
    if (accepted.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(new Error('invalid_photo_format'), { code: 'INVALID_FORMAT' }) as unknown as null,
        false,
      );
    }
  },
});

export const profilesRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Send a 422 response with validation errors if any exist.
 * Returns true if there were errors (caller should return early).
 */
function handleValidationErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      error: 'validation_error',
      message: 'Request validation failed.',
      details: errors.array(),
    });
    return true;
  }
  return false;
}

/**
 * Map a ProfileError to the appropriate HTTP response.
 */
function handleProfileError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ProfileError) {
    const body: Record<string, unknown> = {
      error: err.code,
      message: err.message,
      ...err.extra,
    };
    res.status(err.statusCode).json(body);
  } else {
    next(err);
  }
}

// ── Shared validators ────────────────────────────────────────────────────────

const sportsValidator = body('sports')
  .optional()
  .isArray()
  .withMessage('sports must be an array.')
  .custom((sports: unknown[]) => {
    for (const item of sports) {
      if (typeof item !== 'object' || item === null || !('sportId' in item)) {
        throw new Error('Each sport entry must have a sportId.');
      }
      const entry = item as { sportId: unknown; skillLevel?: unknown };
      if (typeof entry.sportId !== 'string' || entry.sportId.trim() === '') {
        throw new Error('sportId must be a non-empty string.');
      }
      if (
        entry.skillLevel !== undefined &&
        !['Beginner', 'Intermediate', 'Advanced'].includes(entry.skillLevel as string)
      ) {
        throw new Error('skillLevel must be Beginner, Intermediate, or Advanced.');
      }
    }
    return true;
  });

// ── POST /profiles ───────────────────────────────────────────────────────────

/**
 * Create a profile for the authenticated user.
 *
 * Body: { displayName: string, bio?: string, sports?: Array<{ sportId: string, skillLevel?: string }> }
 * Success 201: ProfileWithSports
 * Error 400: bio_too_long | invalid_sport_id
 * Error 409: profile_already_exists
 * Error 422: validation errors
 *
 * Requirements: 2.1, 2.2, 2.3, 2.8
 */
profilesRouter.post(
  '/',
  authenticateToken,
  [
    body('displayName')
      .isString()
      .withMessage('displayName must be a string.')
      .trim()
      .notEmpty()
      .withMessage('displayName is required.'),
    body('bio')
      .optional()
      .isString()
      .withMessage('bio must be a string.'),
    sportsValidator,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { userId } = req.user as unknown as JwtPayload;
      const { displayName, bio, sports: rawSports } = req.body as {
        displayName: string;
        bio?: string;
        sports?: Array<{ sportId: string; skillLevel?: string }>;
      };

      const sports = rawSports?.map((s) => ({
        sportId: s.sportId,
        skillLevel: s.skillLevel as SkillLevel | undefined,
      }));

      const profile = await createUserProfile(userId, { displayName, bio, sports });
      res.status(201).json(profile);
    } catch (err) {
      handleProfileError(err, res, next);
    }
  },
);

// ── PUT /profiles/:userId ────────────────────────────────────────────────────

/**
 * Update the profile for the given userId.
 * The authenticated user must match the userId param.
 *
 * Body: { displayName?: string, bio?: string, sports?: Array<{ sportId: string, skillLevel?: string }> }
 * Success 200: ProfileWithSports
 * Error 400: bio_too_long | invalid_sport_id
 * Error 403: forbidden (userId mismatch)
 * Error 404: profile_not_found
 * Error 422: validation errors
 *
 * Requirements: 2.1, 2.2, 2.3, 2.8
 */
profilesRouter.put(
  '/:userId',
  authenticateToken,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID.'),
    body('displayName')
      .optional()
      .isString()
      .withMessage('displayName must be a string.')
      .trim()
      .notEmpty()
      .withMessage('displayName must not be empty.'),
    body('bio')
      .optional()
      .isString()
      .withMessage('bio must be a string.'),
    sportsValidator,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    const { userId } = req.params;
    const { userId: authenticatedUserId } = req.user as unknown as JwtPayload;

    // Ensure the authenticated user can only update their own profile
    if (userId !== authenticatedUserId) {
      res.status(403).json({
        error: 'forbidden',
        message: 'You are not allowed to update another user\'s profile.',
      });
      return;
    }

    try {
      const { displayName, bio, sports: rawSports } = req.body as {
        displayName?: string;
        bio?: string;
        sports?: Array<{ sportId: string; skillLevel?: string }>;
      };

      const sports = rawSports?.map((s) => ({
        sportId: s.sportId,
        skillLevel: s.skillLevel as SkillLevel | undefined,
      }));

      const profile = await updateUserProfile(userId, { displayName, bio, sports });
      res.status(200).json(profile);
    } catch (err) {
      handleProfileError(err, res, next);
    }
  },
);

// ── GET /profiles/:userId ────────────────────────────────────────────────────

/**
 * Fetch the profile for the given userId, including sports and skill levels.
 *
 * Success 200: ProfileWithSports
 * Error 404: profile_not_found
 *
 * Requirements: 2.1, 2.8
 */
profilesRouter.get(
  '/:userId',
  authenticateToken,
  [param('userId').isUUID().withMessage('userId must be a valid UUID.')],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { userId } = req.params;
      const profile = await getUserProfile(userId);
      res.status(200).json(profile);
    } catch (err) {
      handleProfileError(err, res, next);
    }
  },
);

// ── POST /profiles/:userId/photo ─────────────────────────────────────────────

/**
 * Upload a profile photo for the given userId.
 * Accepts JPEG, PNG, WebP up to 5 MB.
 * Stores a 200×200 thumbnail alongside the original.
 *
 * Multipart form field: `photo`
 * Success 200: { url: string, thumbnailUrl: string }
 * Error 400: invalid_photo_format | photo_too_large
 * Error 403: forbidden (userId mismatch)
 * Error 404: profile_not_found
 *
 * Requirements: 2.4, 2.5
 */
profilesRouter.post(
  '/:userId/photo',
  authenticateToken,
  [param('userId').isUUID().withMessage('userId must be a valid UUID.')],
  (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    const { userId } = req.params;
    const { userId: authenticatedUserId } = req.user as unknown as JwtPayload;

    if (userId !== authenticatedUserId) {
      res.status(403).json({
        error: 'forbidden',
        message: "You are not allowed to update another user's profile.",
      });
      return;
    }

    // Run multer middleware inline so we can handle its errors properly
    upload.single('photo')(req, res, async (multerErr) => {
      if (multerErr) {
        if (multerErr.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: 'photo_too_large',
            message: 'Photo must be 5 MB or smaller.',
            maxBytes: env.MAX_FILE_SIZE_BYTES,
          });
          return;
        }
        if ((multerErr as NodeJS.ErrnoException).code === 'INVALID_FORMAT') {
          res.status(400).json({
            error: 'invalid_photo_format',
            message: 'Unsupported photo format. Please upload a JPEG, PNG, or WebP image.',
            accepted: ['jpeg', 'png', 'webp'],
          });
          return;
        }
        next(multerErr);
        return;
      }

      if (!req.file) {
        res.status(400).json({
          error: 'no_file',
          message: 'No photo file was provided. Use the "photo" form field.',
        });
        return;
      }

      try {
        const result = await uploadPhoto(userId, req.file.buffer, req.file.mimetype);
        res.status(200).json(result);
      } catch (err) {
        handleProfileError(err, res, next);
      }
    });
  },
);

// ── PUT /profiles/:userId/sports ─────────────────────────────────────────────

/**
 * Replace the sports preferences for the given userId.
 * Validates each sportId exists and skillLevel is a valid enum value.
 *
 * Body: Array<{ sportId: string, skillLevel?: 'Beginner' | 'Intermediate' | 'Advanced' }>
 * Success 200: ProfileWithSports
 * Error 400: invalid_sport_id
 * Error 403: forbidden (userId mismatch)
 * Error 404: profile_not_found
 * Error 422: validation errors
 *
 * Requirements: 2.6, 2.7
 */
profilesRouter.put(
  '/:userId/sports',
  authenticateToken,
  [
    param('userId').isUUID().withMessage('userId must be a valid UUID.'),
    body()
      .isArray()
      .withMessage('Request body must be an array of sport entries.')
      .custom((sports: unknown[]) => {
        for (const item of sports) {
          if (typeof item !== 'object' || item === null || !('sportId' in item)) {
            throw new Error('Each sport entry must have a sportId.');
          }
          const entry = item as { sportId: unknown; skillLevel?: unknown };
          if (typeof entry.sportId !== 'string' || entry.sportId.trim() === '') {
            throw new Error('sportId must be a non-empty string.');
          }
          if (
            entry.skillLevel !== undefined &&
            !['Beginner', 'Intermediate', 'Advanced'].includes(entry.skillLevel as string)
          ) {
            throw new Error('skillLevel must be Beginner, Intermediate, or Advanced.');
          }
        }
        return true;
      }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    const { userId } = req.params;
    const { userId: authenticatedUserId } = req.user as unknown as JwtPayload;

    if (userId !== authenticatedUserId) {
      res.status(403).json({
        error: 'forbidden',
        message: "You are not allowed to update another user's profile.",
      });
      return;
    }

    try {
      const rawSports = req.body as Array<{ sportId: string; skillLevel?: string }>;
      const sports = rawSports.map((s) => ({
        sportId: s.sportId,
        skillLevel: s.skillLevel as SkillLevel | undefined,
      }));

      const profile = await updateUserProfile(userId, { sports });
      res.status(200).json(profile);
    } catch (err) {
      handleProfileError(err, res, next);
    }
  },
);

// ── POST /profiles/:userId/ai-suggestions/:suggestionId/accept ───────────────

/**
 * Accept an AI sport suggestion — adds the sport to user preferences.
 * Requirements: 3.3
 */
profilesRouter.post(
  '/:userId/ai-suggestions/:suggestionId/accept',
  authenticateToken,
  [param('userId').isUUID(), param('suggestionId').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ error: 'validation_error' }); return; }

    const { userId } = req.params;
    const { userId: authUserId } = req.user as unknown as JwtPayload;
    if (userId !== authUserId) { res.status(403).json({ error: 'forbidden' }); return; }

    try {
      const { acceptSuggestion } = await import('../services/aiEnrichmentService');
      await acceptSuggestion(userId, req.params.suggestionId);
      res.status(200).json({ message: 'Suggestion accepted.' });
    } catch (err) { next(err); }
  },
);

// ── POST /profiles/:userId/ai-suggestions/:suggestionId/dismiss ──────────────

/**
 * Dismiss an AI sport suggestion.
 * Requirements: 3.3
 */
profilesRouter.post(
  '/:userId/ai-suggestions/:suggestionId/dismiss',
  authenticateToken,
  [param('userId').isUUID(), param('suggestionId').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ error: 'validation_error' }); return; }

    const { userId } = req.params;
    const { userId: authUserId } = req.user as unknown as JwtPayload;
    if (userId !== authUserId) { res.status(403).json({ error: 'forbidden' }); return; }

    try {
      const { dismissSuggestion } = await import('../services/aiEnrichmentService');
      await dismissSuggestion(userId, req.params.suggestionId);
      res.status(200).json({ message: 'Suggestion dismissed.' });
    } catch (err) { next(err); }
  },
);
