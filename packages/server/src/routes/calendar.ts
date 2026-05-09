import { Router, Request, Response, NextFunction } from 'express';
import { param, body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/authenticate';
import { findEventById } from '../repositories/eventRepository';
import { generateICS, createGoogleCalendarEvent } from '../services/calendarService';

export const calendarRouter = Router();

function ve(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'validation_error', details: errors.array() });
    return true;
  }
  return false;
}

// ── POST /events/:id/calendar ─────────────────────────────────────────────────

/**
 * Add an event to the user's calendar.
 * Body: { provider: 'google', accessToken: string }
 * On failure, returns ICS file content as fallback.
 *
 * Requirements: 13.1, 13.2, 13.3
 */
calendarRouter.post(
  '/events/:id/calendar',
  authenticateToken,
  [
    param('id').isUUID(),
    body('provider').optional().isIn(['google']),
    body('accessToken').optional().isString(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (ve(req, res)) return;

    try {
      const event = await findEventById(req.params.id);
      if (!event) {
        res.status(404).json({ error: 'event_not_found' });
        return;
      }

      const { provider, accessToken } = req.body as {
        provider?: string;
        accessToken?: string;
      };

      // Try Google Calendar if token provided
      if (provider === 'google' && accessToken) {
        try {
          const entry = await createGoogleCalendarEvent(accessToken, event);
          res.status(200).json({ success: true, entryId: entry.entryId, provider: 'google' });
          return;
        } catch (err) {
          // Fall through to ICS fallback (Req 13.3)
          console.error('[calendar] Google Calendar API failed, offering ICS:', err);
        }
      }

      // ICS fallback
      const ics = generateICS(event);
      res.status(200).json({
        success: false,
        fallback: 'ics',
        icsContent: ics,
        filename: `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /events/:id/calendar.ics ─────────────────────────────────────────────

/**
 * Download an ICS file for an event directly.
 * Requirements: 13.3
 */
calendarRouter.get(
  '/events/:id/calendar.ics',
  authenticateToken,
  [param('id').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (ve(req, res)) return;

    try {
      const event = await findEventById(req.params.id);
      if (!event) {
        res.status(404).json({ error: 'event_not_found' });
        return;
      }

      const ics = generateICS(event);
      const filename = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(ics);
    } catch (err) {
      next(err);
    }
  },
);
