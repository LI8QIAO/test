const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ymyyliwjztyggrhtnsii.supabase.co';
const SUPABASE_KEY = 'sb_secret_QQuHXBGgA0HhjC4u4mAa7g_7mssCope';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event, context) => {
  const { httpMethod, queryStringParameters, body } = event;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // GET: Check username availability
  if (httpMethod === 'GET') {
    const username = queryStringParameters.username;
    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .single();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ available: !data })
    };
  }

  // POST: Login, Register, Update
  if (httpMethod === 'POST') {
    try {
      const { action, username, password, currentUsername, newUsername, oldPassword, newPassword } = JSON.parse(body);

      if (action === 'register') {
        const { data, error } = await supabase
          .from('users')
          .insert([{ username, password }])
          .select();

        if (error) {
          return { statusCode: 400, headers, body: JSON.stringify({ message: '用户名已被占用或注册失败' }) };
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ user: { username: data[0].username } })
        };
      }

      if (action === 'login') {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .eq('password', password)
          .single();

        if (data) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ user: { username: data.username } })
          };
        }
        return { statusCode: 401, headers, body: JSON.stringify({ message: '用户名或密码错误' }) };
      }

      if (action === 'update') {
        // 1. Verify old password
        const { data: user, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('username', currentUsername)
          .eq('password', oldPassword)
          .single();

        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ message: '原密码验证失败' }) };
        }

        // 2. Prepare update object
        const updates = {};
        if (newUsername && newUsername !== currentUsername) updates.username = newUsername;
        if (newPassword) updates.password = newPassword;

        // 3. Perform update
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('username', currentUsername)
          .select();

        if (updateError) {
          return { statusCode: 400, headers, body: JSON.stringify({ message: '更新失败，用户名可能已被占用' }) };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ user: { username: updatedUser[0].username } })
        };
      }
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ message: 'Server Error' }) };
    }
  }

  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};
