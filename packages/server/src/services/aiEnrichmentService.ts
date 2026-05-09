import { env } from '../config/env';
import { query } from '../infrastructure/database';

/**
 * AI Enrichment Service
 *
 * Uses OpenAI API for NLP (bio text) and Vision AI (profile photos) to
 * suggest sports interests. Also computes compatibility scores.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

export interface SportSuggestion {
  sportId: string;
  sportName: string;
  confidence: number;
  source: 'bio' | 'photo';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAllSportNames(): Promise<Array<{ id: string; name: string }>> {
  const result = await query<{ id: string; name: string }>(
    `SELECT id, name FROM sports ORDER BY name`,
  );
  return result.rows;
}

async function callOpenAI(prompt: string, timeoutMs: number): Promise<string> {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

function parseSportNames(text: string, allSports: Array<{ id: string; name: string }>): SportSuggestion[] {
  const suggestions: SportSuggestion[] = [];
  const lower = text.toLowerCase();

  for (const sport of allSports) {
    if (lower.includes(sport.name.toLowerCase())) {
      suggestions.push({ sportId: sport.id, sportName: sport.name, confidence: 0.8, source: 'bio' });
    }
  }
  return suggestions;
}

// ── NLP from bio ──────────────────────────────────────────────────────────────

/**
 * Analyze bio text and suggest sports using OpenAI NLP.
 * Must complete within 5 seconds (Req 3.1).
 */
export async function suggestSportsFromBio(
  bio: string,
  userId: string,
): Promise<SportSuggestion[]> {
  const trimmed = bio.trim();
  if (!trimmed) return [];

  const allSports = await getAllSportNames();
  const sportNames = allSports.map((s) => s.name).join(', ');

  let suggestions: SportSuggestion[] = [];

  if (env.OPENAI_API_KEY) {
    try {
      const prompt =
        `Given this user bio: "${trimmed}"\n\n` +
        `From this list of sports: ${sportNames}\n\n` +
        `List only the sports that the user is likely interested in based on their bio. ` +
        `Return a comma-separated list of sport names only. If none match, return "none".`;

      const response = await callOpenAI(prompt, 5000);
      if (response.toLowerCase() !== 'none') {
        suggestions = parseSportNames(response, allSports).map((s) => ({ ...s, source: 'bio' as const }));
      }
    } catch (err) {
      console.error('[aiEnrichment] NLP API error:', err);
      // Fall back to keyword matching
      suggestions = parseSportNames(trimmed, allSports).map((s) => ({ ...s, source: 'bio' as const }));
    }
  } else {
    // Keyword matching fallback when no API key
    suggestions = parseSportNames(trimmed, allSports).map((s) => ({ ...s, source: 'bio' as const }));
  }

  // Persist suggestions
  for (const s of suggestions) {
    await query(
      `INSERT INTO ai_suggestions (user_id, sport_id, source, confidence, status)
       VALUES ($1, $2, 'bio', $3, 'pending')
       ON CONFLICT DO NOTHING`,
      [userId, s.sportId, s.confidence],
    ).catch(() => {});
  }

  return suggestions;
}

// ── Vision AI from photo ──────────────────────────────────────────────────────

/**
 * Analyze a profile photo and suggest sports using OpenAI Vision.
 * Must complete within 10 seconds (Req 3.2).
 */
export async function suggestSportsFromPhoto(
  imageUrl: string,
  userId: string,
): Promise<SportSuggestion[]> {
  const allSports = await getAllSportNames();
  const sportNames = allSports.map((s) => s.name).join(', ');

  if (!env.OPENAI_API_KEY) return [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `From this list of sports: ${sportNames}\n\nWhich sports can you infer from this image? Return a comma-separated list of sport names only. If none, return "none".` },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        }],
        max_tokens: 100,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return [];
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const text = data.choices[0]?.message?.content ?? '';

    if (text.toLowerCase() === 'none') return [];

    const suggestions = parseSportNames(text, allSports).map((s) => ({ ...s, source: 'photo' as const }));

    for (const s of suggestions) {
      await query(
        `INSERT INTO ai_suggestions (user_id, sport_id, source, confidence, status)
         VALUES ($1, $2, 'photo', $3, 'pending')
         ON CONFLICT DO NOTHING`,
        [userId, s.sportId, s.confidence],
      ).catch(() => {});
    }

    return suggestions;
  } catch (err) {
    console.error('[aiEnrichment] Vision API error:', err);
    return [];
  }
}

// ── Suggestion accept/dismiss ─────────────────────────────────────────────────

export async function acceptSuggestion(userId: string, suggestionId: string): Promise<void> {
  // Get the sport ID from the suggestion
  const result = await query<{ sport_id: string }>(
    `UPDATE ai_suggestions SET status = 'accepted'
     WHERE id = $1 AND user_id = $2
     RETURNING sport_id`,
    [suggestionId, userId],
  );
  if (result.rows.length === 0) return;

  // Add sport to user preferences
  await query(
    `INSERT INTO user_sports (user_id, sport_id) VALUES ($1, $2)
     ON CONFLICT (user_id, sport_id) DO NOTHING`,
    [userId, result.rows[0].sport_id],
  );
}

export async function dismissSuggestion(userId: string, suggestionId: string): Promise<void> {
  await query(
    `UPDATE ai_suggestions SET status = 'dismissed' WHERE id = $1 AND user_id = $2`,
    [suggestionId, userId],
  );
}

// ── Compatibility scoring ─────────────────────────────────────────────────────

/**
 * Compute a compatibility score between two users for a sport.
 * Score is in [0.0, 1.0]. Symmetric: score(A,B) == score(B,A).
 *
 * Requirements: 3.5
 */
export async function computeCompatibilityScore(
  userAId: string,
  userBId: string,
  sportId: string,
): Promise<number> {
  // Canonical ordering for symmetry
  const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];

  // Check cache
  const cached = await query<{ score: number }>(
    `SELECT score FROM compatibility_scores
     WHERE user_a_id = $1 AND user_b_id = $2 AND sport_id = $3 LIMIT 1`,
    [a, b, sportId],
  );
  if (cached.rows.length > 0) return cached.rows[0].score;

  // Compute: skill level match (0.5 weight) + shared sport interests (0.5 weight)
  const skillResult = await query<{ skill_a: string | null; skill_b: string | null }>(
    `SELECT
       (SELECT skill_level FROM user_sports WHERE user_id = $1 AND sport_id = $3) AS skill_a,
       (SELECT skill_level FROM user_sports WHERE user_id = $2 AND sport_id = $3) AS skill_b`,
    [a, b, sportId],
  );

  const SKILL_MAP: Record<string, number> = { Beginner: 1, Intermediate: 2, Advanced: 3 };
  const skillA = SKILL_MAP[skillResult.rows[0]?.skill_a ?? ''] ?? 2;
  const skillB = SKILL_MAP[skillResult.rows[0]?.skill_b ?? ''] ?? 2;
  const skillDiff = Math.abs(skillA - skillB);
  const skillScore = skillDiff === 0 ? 1.0 : skillDiff === 1 ? 0.7 : 0.3;

  // Shared AI-suggested sports
  const sharedResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM ai_suggestions sa
     JOIN ai_suggestions sb ON sa.sport_id = sb.sport_id
     WHERE sa.user_id = $1 AND sb.user_id = $2
       AND sa.status != 'dismissed' AND sb.status != 'dismissed'`,
    [a, b],
  );
  const sharedCount = parseInt(sharedResult.rows[0]?.count ?? '0', 10);
  const interestScore = Math.min(sharedCount / 3, 1.0);

  const score = Math.round((skillScore * 0.6 + interestScore * 0.4) * 100) / 100;

  // Cache the score
  await query(
    `INSERT INTO compatibility_scores (user_a_id, user_b_id, sport_id, score)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_a_id, user_b_id, sport_id) DO UPDATE SET score = $4, computed_at = NOW()`,
    [a, b, sportId, score],
  ).catch(() => {});

  return score;
}
