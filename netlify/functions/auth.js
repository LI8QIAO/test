const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.handler = async (event, context) => {
  const { httpMethod, queryStringParameters, body } = event;

  // Handle preflight OPTIONS request
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    };
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
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
          .select()
          .single();

        if (error) {
          return { 
            statusCode: 400, 
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: error.code === '23505' ? '用户名已被占用' : '注册失败' }) 
          };
        }
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ user: { username: data.username } })
        };
      }

      if (action === 'login') {
        const { data, error } = await supabase
          .from('users')
          .select('username, password')
          .eq('username', username)
          .single();

        if (data && data.password === password) {
          return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ user: { username: data.username } })
          };
        }
        return { 
          statusCode: 401, 
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: '用户名或密码错误' }) 
        };
      }

      if (action === 'update') {
        // 1. Verify old password
        const { data: user, error: fetchError } = await supabase
          .from('users')
          .select('id, password')
          .eq('username', currentUsername)
          .single();

        if (!user || user.password !== oldPassword) {
          return { 
            statusCode: 401, 
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: '原密码验证失败' }) 
          };
        }

        // 2. Prepare update data
        const updates = {};
        if (newUsername && newUsername !== currentUsername) updates.username = newUsername;
        if (newPassword) updates.password = newPassword;

        if (Object.keys(updates).length === 0) {
          return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ user: { username: currentUsername } }) };
        }

        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single();

        if (updateError) {
          return { 
            statusCode: 400, 
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: updateError.code === '23505' ? '新用户名已被占用' : '修改失败' }) 
          };
        }

        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ user: { username: updatedUser.username } })
        };
      }
    } catch (e) {
      return { 
        statusCode: 500, 
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Server Error' }) 
      };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
