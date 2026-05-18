const jsonResponse = (data, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
};

const MODES = ['stroop', 'direction', 'numbers', 'mirror', 'semantic', 'chaos'];

const cacheKeyForMode = (modeId) => `lb:${modeId}`;

export const onRequestOptions = async () => new Response(null, { status: 204 });

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
  const modeId = payload.modeId;
  const accuracy = Number(payload.accuracy) || 0;
  const avgTime = Number(payload.avgTime) || 0;
  const antiIndex = Number(payload.antiIndex) || 0;

  if (!username || !MODES.includes(modeId)) return jsonResponse({ message: 'Invalid payload' }, { status: 400 });

  const user = await db
    .prepare('SELECT id FROM users WHERE username = ? LIMIT 1')
    .bind(username)
    .first();
  if (!user) return jsonResponse({ message: 'Not logged in' }, { status: 401 });

  const now = Date.now();
  const runId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO test_runs (id, user_id, mode_id, accuracy, avg_time_ms, anti_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(runId, user.id, modeId, accuracy, avgTime, antiIndex, now)
    .run();

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

  return jsonResponse({ message: 'Run saved', id: runId });
};

