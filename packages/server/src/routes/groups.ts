import { Router, Request, Response, NextFunction } from 'express';
import { param, validationResult } from 'express-validator';
import { authenticateToken, JwtPayload } from '../middleware/authenticate';
import { balanceTeams } from '../services/matchingEngine';
import { confirmMatch, declineMatch, ConfirmationError, CONFIRMATION_DEADLINE_MS } from '../services/confirmationService';
import { findGroupById, findMembersByGroupId } from '../repositories/groupRepository';
import { notificationService } from '../services/notificationService';

export const groupsRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function handleValidationErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'validation_error', message: 'Invalid request.', details: errors.array() });
    return true;
  }
  return false;
}

// ── GET /groups/:id/teams ─────────────────────────────────────────────────────

/**
 * Get team assignments for a group.
 * If teams have not been assigned yet, computes and persists them.
 *
 * Success 200: { teamA: string[], teamB: string[] }
 * Error 404: group not found
 *
 * Requirements: 15.1
 */
groupsRouter.get(
  '/:id/teams',
  authenticateToken,
  [param('id').isUUID().withMessage('id must be a valid UUID.')],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { id } = req.params;
      const group = await findGroupById(id);
      if (!group) {
        res.status(404).json({ error: 'group_not_found', message: 'Group not found.' });
        return;
      }

      // Check if teams are already assigned
      const members = await findMembersByGroupId(id);
      const hasTeams = members.some((m) => m.team !== null);

      if (hasTeams) {
        const teamA = members.filter((m) => m.team === 'A').map((m) => m.userId);
        const teamB = members.filter((m) => m.team === 'B').map((m) => m.userId);
        res.status(200).json({ teamA, teamB });
        return;
      }

      // Compute and persist team assignments
      const assignment = await balanceTeams(id);
      res.status(200).json(assignment);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /groups/:id/confirm ──────────────────────────────────────────────────

/**
 * Confirm a group match for the authenticated user.
 * If all minimum-required members confirm, the group transitions to Active.
 *
 * Success 200: { message: string }
 * Error 400: group_dissolved | group_already_active
 * Error 403: not_a_member
 * Error 404: group_not_found
 *
 * Requirements: 6.1, 6.2, 6.4
 */
groupsRouter.post(
  '/:id/confirm',
  authenticateToken,
  [param('id').isUUID().withMessage('id must be a valid UUID.')],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { id } = req.params;
      const { userId } = req.user as unknown as JwtPayload;

      await confirmMatch(id, userId);

      // Schedule the 30-minute confirmation deadline check
      setTimeout(async () => {
        try {
          const { processConfirmationDeadline } = await import('../services/confirmationService');
          await processConfirmationDeadline(id);
        } catch (err) {
          console.error(`[groups] Confirmation deadline processing failed for group ${id}:`, err);
        }
      }, CONFIRMATION_DEADLINE_MS);

      res.status(200).json({ message: 'Match confirmed.' });
    } catch (err) {
      if (err instanceof ConfirmationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message });
      } else {
        next(err);
      }
    }
  },
);

// ── POST /groups/:id/decline ──────────────────────────────────────────────────

/**
 * Decline a group match for the authenticated user.
 * Attempts to fill the vacancy; dissolves the group if minimum cannot be met.
 *
 * Success 200: { message: string }
 * Error 400: group_not_pending
 * Error 404: group_not_found
 *
 * Requirements: 6.3, 6.5, 6.6
 */
groupsRouter.post(
  '/:id/decline',
  authenticateToken,
  [param('id').isUUID().withMessage('id must be a valid UUID.')],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { id } = req.params;
      const { userId } = req.user as unknown as JwtPayload;

      await declineMatch(id, userId);
      res.status(200).json({ message: 'Match declined.' });
    } catch (err) {
      if (err instanceof ConfirmationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message });
      } else {
        next(err);
      }
    }
  },
);

// ── GET /groups/:id ───────────────────────────────────────────────────────────

/**
 * Get group details including state, members, and captain.
 *
 * Success 200: { group, members }
 * Error 404: group not found
 *
 * Requirements: 6.4, 6.5
 */
groupsRouter.get(
  '/:id',
  authenticateToken,
  [param('id').isUUID().withMessage('id must be a valid UUID.')],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { id } = req.params;
      const group = await findGroupById(id);
      if (!group) {
        res.status(404).json({ error: 'group_not_found', message: 'Group not found.' });
        return;
      }

      const members = await findMembersByGroupId(id);
      res.status(200).json({ group, members });
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /groups/:id/captain ───────────────────────────────────────────────────

/**
 * Reassign the captain role to another confirmed group member.
 * Only the current captain can reassign.
 *
 * Body: { newCaptainUserId: string }
 * Success 200: { message: string }
 * Error 400: not_captain | user_not_confirmed_member
 * Error 404: group not found
 *
 * Requirements: 7.4
 */
groupsRouter.put(
  '/:id/captain',
  authenticateToken,
  [
    param('id').isUUID().withMessage('id must be a valid UUID.'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { id } = req.params;
      const { userId } = req.user as unknown as JwtPayload;
      const { newCaptainUserId } = req.body as { newCaptainUserId?: string };

      if (!newCaptainUserId) {
        res.status(422).json({ error: 'validation_error', message: 'newCaptainUserId is required.' });
        return;
      }

      const group = await findGroupById(id);
      if (!group) {
        res.status(404).json({ error: 'group_not_found', message: 'Group not found.' });
        return;
      }

      if (group.captainUserId !== userId) {
        res.status(403).json({ error: 'not_captain', message: 'Only the current captain can reassign the role.' });
        return;
      }

      // Verify the new captain is a confirmed member
      const members = await findMembersByGroupId(id);
      const isConfirmedMember = members.some(
        (m) => m.userId === newCaptainUserId && m.confirmationStatus === 'Confirmed',
      );
      if (!isConfirmedMember) {
        res.status(400).json({ error: 'user_not_confirmed_member', message: 'The new captain must be a confirmed group member.' });
        return;
      }

      const { setGroupCaptain } = await import('../repositories/groupRepository');
      await setGroupCaptain(id, newCaptainUserId);
      await notificationService.sendCaptainAssigned(newCaptainUserId, id);

      res.status(200).json({ message: 'Captain reassigned.' });
    } catch (err) {
      next(err);
    }
  },
);
