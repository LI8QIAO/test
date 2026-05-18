const jsonResponse = (data, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
};

const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const b64FromBytes = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const bytesFromB64 = (b64) => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const pbkdf2Hash = async ({ password, saltBytes, iterations = 100000, length = 32 }) => {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    keyMaterial,
    length * 8,
  );
  return new Uint8Array(bits);
};

const normalizeUsername = (username) => (username || '').trim();

export const onRequestOptions = async () => new Response(null, { status: 204 });

export const onRequestGet = async (context) => {
  const db = context.env.REACTION_DB;
  const url = new URL(context.request.url);
  const username = normalizeUsername(url.searchParams.get('username'));
  if (!username) return jsonResponse({ message: 'Missing username' }, { status: 400 });

  const existing = await db
    .prepare('SELECT 1 AS one FROM users WHERE username = ? LIMIT 1')
    .bind(username)
    .first();

  return jsonResponse({ available: !existing });
};

export const onRequestPost = async (context) => {
  const db = context.env.REACTION_DB;
  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON' }, { status: 400 });
  }

  const action = payload?.action;

  if (action === 'register') {
    const username = normalizeUsername(payload.username);
    const password = payload.password || '';
    if (!username || !password) return jsonResponse({ message: 'Missing username or password' }, { status: 400 });

    const existing = await db
      .prepare('SELECT 1 AS one FROM users WHERE username = ? LIMIT 1')
      .bind(username)
      .first();
    if (existing) return jsonResponse({ message: '用户名已被占用' }, { status: 409 });

    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const hashBytes = await pbkdf2Hash({ password, saltBytes });
    const userId = crypto.randomUUID();
    const createdAt = Date.now();

    await db
      .prepare('INSERT INTO users (id, username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(userId, username, b64FromBytes(hashBytes), b64FromBytes(saltBytes), createdAt)
      .run();

    return jsonResponse({ user: { id: userId, username } });
  }

  if (action === 'login') {
    const username = normalizeUsername(payload.username);
    const password = payload.password || '';
    if (!username || !password) return jsonResponse({ message: 'Missing username or password' }, { status: 400 });

    const row = await db
      .prepare('SELECT id, username, password_hash, password_salt FROM users WHERE username = ? LIMIT 1')
      .bind(username)
      .first();
    if (!row) return jsonResponse({ message: '用户名或密码错误' }, { status: 401 });

    const saltBytes = bytesFromB64(row.password_salt);
    const hashBytes = await pbkdf2Hash({ password, saltBytes });
    const calcHash = b64FromBytes(hashBytes);

    if (!timingSafeEqual(calcHash, row.password_hash)) {
      return jsonResponse({ message: '用户名或密码错误' }, { status: 401 });
    }

    return jsonResponse({ user: { id: row.id, username: row.username } });
  }

  if (action === 'update') {
    const currentUsername = normalizeUsername(payload.currentUsername);
    const newUsername = normalizeUsername(payload.newUsername);
    const oldPassword = payload.oldPassword || '';
    const newPassword = payload.newPassword || '';

    if (!currentUsername || !oldPassword) return jsonResponse({ message: 'Missing currentUsername or oldPassword' }, { status: 400 });

    const row = await db
      .prepare('SELECT id, username, password_hash, password_salt FROM users WHERE username = ? LIMIT 1')
      .bind(currentUsername)
      .first();
    if (!row) return jsonResponse({ message: '原密码验证失败' }, { status: 401 });

    const saltBytes = bytesFromB64(row.password_salt);
    const hashBytes = await pbkdf2Hash({ password: oldPassword, saltBytes });
    const calcHash = b64FromBytes(hashBytes);
    if (!timingSafeEqual(calcHash, row.password_hash)) {
      return jsonResponse({ message: '原密码验证失败' }, { status: 401 });
    }

    let targetUsername = row.username;
    if (newUsername && newUsername !== row.username) {
      const existing = await db
        .prepare('SELECT 1 AS one FROM users WHERE username = ? LIMIT 1')
        .bind(newUsername)
        .first();
      if (existing) return jsonResponse({ message: '新用户名已被占用' }, { status: 409 });

      await db
        .prepare('UPDATE users SET username = ? WHERE id = ?')
        .bind(newUsername, row.id)
        .run();
      targetUsername = newUsername;
    }

    if (newPassword) {
      const newSalt = crypto.getRandomValues(new Uint8Array(16));
      const newHash = await pbkdf2Hash({ password: newPassword, saltBytes: newSalt });
      await db
        .prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
        .bind(b64FromBytes(newHash), b64FromBytes(newSalt), row.id)
        .run();
    }

    return jsonResponse({ user: { id: row.id, username: targetUsername } });
  }

  return jsonResponse({ message: 'Invalid action' }, { status: 400 });
};
