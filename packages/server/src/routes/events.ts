import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query as qv, validationResult } from 'express-validator';
import { authenticateToken, JwtPayload } from '../middleware/authenticate';
import {
  createEvent, findEventById, findPublicEvents,
  addEventParticipant, updateParticipantStatus, countConfirmedParticipants,
  updateEventState, generateShareToken,
} from '../repositories/eventRepository';
import { notificationService } from '../services/notificationService';
import { getNearbyEvents } from './venues';

export const eventsRouter = Router();

function ve(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ error: 'validation_error', details: errors.array() }); return true; }
  return false;
}

// POST /events
eventsRouter.post('/', authenticateToken,
  [
    body('sportId').isUUID(), body('title').isString().trim().notEmpty(),
    body('startTime').isISO8601(), body('minParticipants').isInt({ min: 1 }),
    body('maxParticipants').isInt({ min: 1 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (ve(req, res)) return;
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const b = req.body as Record<string, unknown>;
      const event = await createEvent({
        sportId: b.sportId as string, captainUserId: userId,
        title: b.title as string, description: b.description as string | undefined,
        venueName: b.venueName as string | undefined, venueAddress: b.venueAddress as string | undefined,
        venueLat: b.venueLat as number | undefined, venueLng: b.venueLng as number | undefined,
        startTime: new Date(b.startTime as string),
        endTime: b.endTime ? new Date(b.endTime as string) : undefined,
        minParticipants: b.minParticipants as number, maxParticipants: b.maxParticipants as number,
        isPublic: b.isPublic !== false,
      });
      // Invite specified users
      const invitedUserIds = (b.invitedUserIds as string[] | undefined) ?? [];
      for (const uid of invitedUserIds) {
        await addEventParticipant(event.id, uid);
        await notificationService.sendMatchConfirmation(uid, event.id, 0);
      }
      res.status(201).json(event);
    } catch (err) { next(err); }
  },
);

// GET /events
eventsRouter.get('/', authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await findPublicEvents({
        sportId: req.query.sportId as string | undefined,
        startAfter: req.query.startAfter ? new Date(req.query.startAfter as string) : undefined,
      });
      res.status(200).json(events);
    } catch (err) { next(err); }
  },
);

// GET /events/nearby
eventsRouter.get('/nearby', authenticateToken,
  [qv('lat').isFloat(), qv('lng').isFloat()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (ve(req, res)) return;
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const events = await getNearbyEvents(lat, lng, 10);
      res.status(200).json(events);
    } catch (err) { next(err); }
  },
);

// GET /events/:id
eventsRouter.get('/:id', authenticateToken, [param('id').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (ve(req, res)) return;
    try {
      const event = await findEventById(req.params.id);
      if (!event) { res.status(404).json({ error: 'event_not_found' }); return; }
      res.status(200).json(event);
    } catch (err) { next(err); }
  },
);

// POST /events/:id/invite-response
eventsRouter.post('/:id/invite-response', authenticateToken,
  [param('id').isUUID(), body('accept').isBoolean()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (ve(req, res)) return;
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const event = await findEventById(req.params.id);
      if (!event) { res.status(404).json({ error: 'event_not_found' }); return; }

      const accept = (req.body as { accept: boolean }).accept;
      const status = accept ? 'Confirmed' : 'Declined';
      await updateParticipantStatus(req.params.id, userId, status);

      if (accept) {
        const count = await countConfirmedParticipants(req.params.id);
        if (count >= event.maxParticipants) {
          await updateEventState(req.params.id, 'full' as never);
          await notificationService.sendMatchFound(event.captainUserId, req.params.id);
        }
      } else {
        await notificationService.sendMatchFound(event.captainUserId, req.params.id);
      }

      res.status(200).json({ message: accept ? 'Invitation accepted.' : 'Invitation declined.' });
    } catch (err) { next(err); }
  },
);

// GET /events/:id/share-link
eventsRouter.get('/:id/share-link', authenticateToken, [param('id').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (ve(req, res)) return;
    try {
      const event = await findEventById(req.params.id);
      if (!event) { res.status(404).json({ error: 'event_not_found' }); return; }
      const token = await generateShareToken(req.params.id);
      const shareUrl = `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/events/${req.params.id}?share=${token}`;
      res.status(200).json({ url: shareUrl });
    } catch (err) { next(err); }
  },
);
