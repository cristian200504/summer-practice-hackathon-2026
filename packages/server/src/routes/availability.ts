import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, JwtPayload } from '../middleware/authenticate';
import {
  recordResponse,
  updateResponse,
  getTodayResponse,
  AvailabilityError,
} from '../services/availabilityService';

/**
 * Availability routes — "ShowUpToday?"
 *
 * All routes require authentication.
 *
 * POST   /availability          — record today's Yes/No response
 * PUT    /availability/:id      — update a response (rejected if locked)
 * GET    /availability/today    — return today's response for the user
 *
 * Requirements: 4.3, 4.4, 4.7, 4.8
 */

export const availabilityRouter = Router();

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
 * Map an AvailabilityError to the appropriate HTTP response.
 */
function handleAvailabilityError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof AvailabilityError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
  } else {
    next(err);
  }
}

// ── Shared validators ────────────────────────────────────────────────────────

const sportIdsValidator = body('sportIds')
  .optional()
  .isArray()
  .withMessage('sportIds must be an array.')
  .custom((ids: unknown[]) => {
    for (const id of ids) {
      if (typeof id !== 'string' || id.trim() === '') {
        throw new Error('Each sportId must be a non-empty string.');
      }
    }
    return true;
  });

// ── POST /availability ───────────────────────────────────────────────────────

/**
 * Record a Yes/No availability response for the authenticated user.
 *
 * Body: { available: boolean, sportIds?: string[] }
 * Success 201: AvailabilityResponse
 * Error 409: response_already_exists
 * Error 422: validation errors
 *
 * Requirements: 4.3, 4.4, 4.8
 */
availabilityRouter.post(
  '/',
  authenticateToken,
  [
    body('available')
      .isBoolean()
      .withMessage('available must be a boolean.'),
    sportIdsValidator,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { userId } = req.user as unknown as JwtPayload;
      const { available, sportIds } = req.body as {
        available: boolean;
        sportIds?: string[];
      };

      const response = await recordResponse(userId, available, sportIds ?? []);
      res.status(201).json(response);
    } catch (err) {
      handleAvailabilityError(err, res, next);
    }
  },
);

// ── GET /availability/today ──────────────────────────────────────────────────

/**
 * Return the current day's availability response for the authenticated user.
 * Returns null (200 with body null) if the user has not yet responded today.
 *
 * Success 200: AvailabilityResponse | null
 *
 * Requirements: 4.3, 4.8
 *
 * NOTE: This route must be registered BEFORE PUT /availability/:id so that
 * the literal path segment "today" is not mistaken for a UUID parameter.
 */
availabilityRouter.get(
  '/today',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const response = await getTodayResponse(userId);
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /availability/:id ────────────────────────────────────────────────────

/**
 * Update an existing availability response.
 * Rejected with 400 if the response is locked for matching.
 * Rejected with 403 if the response does not belong to the authenticated user.
 * Rejected with 404 if the response is not found.
 *
 * Body: { available: boolean, sportIds?: string[] }
 * Success 200: AvailabilityResponse
 * Error 400: response_locked
 * Error 403: forbidden
 * Error 404: response_not_found
 * Error 422: validation errors
 *
 * Requirements: 4.7
 */
availabilityRouter.put(
  '/:id',
  authenticateToken,
  [
    param('id').isUUID().withMessage('id must be a valid UUID.'),
    body('available')
      .isBoolean()
      .withMessage('available must be a boolean.'),
    sportIdsValidator,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { userId } = req.user as unknown as JwtPayload;
      const { id } = req.params;
      const { available, sportIds } = req.body as {
        available: boolean;
        sportIds?: string[];
      };

      const response = await updateResponse(id, userId, available, sportIds ?? []);
      res.status(200).json(response);
    } catch (err) {
      handleAvailabilityError(err, res, next);
    }
  },
);
