const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.handler = async (event, context) => {
  const { httpMethod, queryStringParameters, body } = event;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // GET: Check username availability
  if (httpMethod === 'GET') {
    const username = queryStringParameters.username;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .maybeSingle(); // maybeSingle handles 0 rows without throwing error

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ available: !data })
      };
    } catch (e) {
      console.error('Check Username Error:', e);
      return { statusCode: 500, headers, body: JSON.stringify({ message: '服务器查询失败' }) };
    }
  }

  // POST: Login, Register, Update
  if (httpMethod === 'POST') {
    try {
      const { action, username, password, currentUsername, newUsername, oldPassword, newPassword } = JSON.parse(body);

      if (action === 'register') {
        const { data, error } = await supabase
          .from('users')
          .insert([{ username, password }])
          .select('username')
          .single();

        if (error) {
          console.error('Register Error:', error);
          return { 
            statusCode: error.code === '23505' ? 409 : 400, 
            headers,
            body: JSON.stringify({ message: error.code === '23505' ? '用户名已被占用' : '注册失败: ' + error.message }) 
          };
        }
        return { statusCode: 200, headers, body: JSON.stringify({ user: data }) };
      }

      if (action === 'login') {
        const { data, error } = await supabase
          .from('users')
          .select('username, password')
          .eq('username', username)
          .maybeSingle();

        if (error) throw error;

        if (data && data.password === password) {
          return { statusCode: 200, headers, body: JSON.stringify({ user: { username: data.username } }) };
        }
        return { statusCode: 401, headers, body: JSON.stringify({ message: '用户名或密码错误' }) };
      }

      if (action === 'update') {
        const { data: user, error: fetchError } = await supabase
          .from('users')
          .select('id, password')
          .eq('username', currentUsername)
          .maybeSingle();

        if (!user || user.password !== oldPassword) {
          return { statusCode: 401, headers, body: JSON.stringify({ message: '原密码验证失败' }) };
        }

        const updates = {};
        if (newUsername && newUsername !== currentUsername) updates.username = newUsername;
        if (newPassword) updates.password = newPassword;

        if (Object.keys(updates).length === 0) {
          return { statusCode: 200, headers, body: JSON.stringify({ user: { username: currentUsername } }) };
        }

        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id)
          .select('username')
          .single();

        if (updateError) {
          return { 
            statusCode: updateError.code === '23505' ? 409 : 400, 
            headers,
            body: JSON.stringify({ message: updateError.code === '23505' ? '新用户名已被占用' : '修改失败' }) 
          };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ user: updatedUser }) };
      }
    } catch (e) {
      console.error('Main Auth Error:', e);
      return { statusCode: 500, headers, body: JSON.stringify({ message: '内部服务器错误' }) };
    }
  }

  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};
