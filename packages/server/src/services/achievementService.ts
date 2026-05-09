import { query } from '../infrastructure/database';
import { notificationService } from './notificationService';

/**
 * Achievement Service
 *
 * Evaluates achievement criteria after each event attendance or role assignment.
 * Requirements: 16.1, 16.2
 */

interface AchievementRow {
  id: string;
  key: string;
  title: string;
  description: string;
  icon_url: string | null;
}

async function getUnearned(userId: string): Promise<AchievementRow[]> {
  const result = await query<AchievementRow>(
    `SELECT a.id, a.key, a.title, a.description, a.icon_url
     FROM achievements a
     WHERE a.id NOT IN (
       SELECT achievement_id FROM user_achievements WHERE user_id = $1
     )`,
    [userId],
  );
  return result.rows;
}

async function grantAchievement(userId: string, achievementId: string, title: string): Promise<void> {
  await query(
    `INSERT INTO user_achievements (user_id, achievement_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, achievementId],
  );
  await notificationService.sendAchievementUnlocked(userId, title).catch(() => {});
}

/**
 * Evaluate all achievement criteria for a user and grant any newly met ones.
 * Called after event attendance or role assignment.
 * Requirements: 16.1, 16.2
 */
export async function evaluateAchievements(userId: string): Promise<void> {
  const unearned = await getUnearned(userId);
  if (unearned.length === 0) return;

  // Count attended events
  const eventsResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM event_participants
     WHERE user_id = $1 AND status = 'Confirmed'`,
    [userId],
  );
  const eventCount = parseInt(eventsResult.rows[0]?.count ?? '0', 10);

  // Count distinct sports played
  const sportsResult = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT e.sport_id)::text AS count
     FROM event_participants ep
     JOIN events e ON e.id = ep.event_id
     WHERE ep.user_id = $1 AND ep.status = 'Confirmed'`,
    [userId],
  );
  const sportsCount = parseInt(sportsResult.rows[0]?.count ?? '0', 10);

  // Check captain role
  const captainResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM groups WHERE captain_user_id = $1`,
    [userId],
  );
  const captainCount = parseInt(captainResult.rows[0]?.count ?? '0', 10);

  // Check invitations sent
  const inviteResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM event_participants ep
     JOIN events e ON e.id = ep.event_id
     WHERE e.captain_user_id = $1 AND ep.user_id != $1`,
    [userId],
  );
  const inviteCount = parseInt(inviteResult.rows[0]?.count ?? '0', 10);

  for (const ach of unearned) {
    let met = false;
    switch (ach.key) {
      case 'first_event':   met = eventCount >= 1; break;
      case 'five_events':   met = eventCount >= 5; break;
      case 'ten_events':    met = eventCount >= 10; break;
      case 'first_captain': met = captainCount >= 1; break;
      case 'three_sports':  met = sportsCount >= 3; break;
      case 'invited_friend': met = inviteCount >= 1; break;
    }
    if (met) await grantAchievement(userId, ach.id, ach.title);
  }
}

/**
 * Get leaderboard ranked by total achievement count.
 * Requirements: 16.4
 */
export async function getLeaderboard(_sportId?: string): Promise<Array<{
  userId: string;
  displayName: string;
  thumbnailUrl: string | null;
  achievementCount: number;
}>> {
  const result = await query<{
    user_id: string;
    display_name: string;
    thumbnail_url: string | null;
    achievement_count: string;
  }>(
    `SELECT p.user_id, p.display_name, p.thumbnail_url,
            COUNT(ua.id)::text AS achievement_count
     FROM profiles p
     LEFT JOIN user_achievements ua ON ua.user_id = p.user_id
     GROUP BY p.user_id, p.display_name, p.thumbnail_url
     ORDER BY COUNT(ua.id) DESC
     LIMIT 50`,
  );

  return result.rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    thumbnailUrl: r.thumbnail_url,
    achievementCount: parseInt(r.achievement_count, 10),
  }));
}
