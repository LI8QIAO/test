const jsonResponse = (data, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
};

const MODES = ['stroop', 'direction', 'numbers', 'mirror', 'semantic', 'chaos'];

const cacheKeyForMode = (modeId) => `lb:${modeId}`;

const getTop100ForMode = async ({ db, kv, modeId }) => {
  const cached = await kv.get(cacheKeyForMode(modeId), { type: 'json' });
  if (cached) return cached;

  const { results } = await db
    .prepare(
      `SELECT
        u.username AS username,
        b.mode_id AS modeId,
        b.accuracy AS accuracy,
        b.avg_time_ms AS avgTime,
        b.anti_index AS antiIndex,
        b.updated_at AS updatedAt
      FROM best_scores b
      JOIN users u ON u.id = b.user_id
      WHERE b.mode_id = ?
      ORDER BY b.anti_index DESC
      LIMIT 100`,
    )
    .bind(modeId)
    .all();

  await kv.put(cacheKeyForMode(modeId), JSON.stringify(results), { expirationTtl: 120 });
  return results;
};

export const onRequestOptions = async () => new Response(null, { status: 204 });

export const onRequestGet = async (context) => {
  const db = context.env.REACTION_DB;
  const kv = context.env.LEADERBOARD_KV;

  const url = new URL(context.request.url);
  const mode = url.searchParams.get('mode');
  if (mode) {
    if (!MODES.includes(mode)) return jsonResponse({ message: 'Invalid mode' }, { status: 400 });
    const scores = await getTop100ForMode({ db, kv, modeId: mode });
    return jsonResponse({ [mode]: scores });
  }

  const data = {};
  for (const modeId of MODES) {
    data[modeId] = await getTop100ForMode({ db, kv, modeId });
  }
  return jsonResponse(data);
};

export const onRequestPost = async (context) => {
  const db = context.env.REACTION_DB;
  const kv = context.env.LEADERBOARD_KV;

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON' }, { status: 400 });
  }

  const username = (payload.username || '').trim();
  const scores = Array.isArray(payload.scores) ? payload.scores : null;
  if (!username || !scores) return jsonResponse({ message: 'Missing username or scores' }, { status: 400 });

  const user = await db
    .prepare('SELECT id FROM users WHERE username = ? LIMIT 1')
    .bind(username)
    .first();
  if (!user) return jsonResponse({ message: 'Not logged in' }, { status: 401 });

  const now = Date.now();
  for (const score of scores) {
    const modeId = score.modeId;
    if (!MODES.includes(modeId)) continue;

    const accuracy = Number(score.accuracy) || 0;
    const avgTime = Number(score.avgTime) || 0;
    const antiIndex = Number(score.antiIndex) || 0;

    await db
      .prepare(
        `INSERT INTO best_scores (user_id, mode_id, accuracy, avg_time_ms, anti_index, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, mode_id) DO UPDATE SET
           accuracy = excluded.accuracy,
           avg_time_ms = excluded.avg_time_ms,
           anti_index = excluded.anti_index,
           updated_at = excluded.updated_at
         WHERE excluded.anti_index > best_scores.anti_index`,
      )
      .bind(user.id, modeId, accuracy, avgTime, antiIndex, now)
      .run();

    await kv.delete(cacheKeyForMode(modeId));
  }

  return jsonResponse({ message: 'Scores updated' });
};
