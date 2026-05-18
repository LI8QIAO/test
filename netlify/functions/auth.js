// Simple in-memory user store for demo purposes.
// In a real production environment, use a proper database.
let users = {}; 

exports.handler = async (event, context) => {
  const { httpMethod, queryStringParameters, body } = event;

  // GET: Check username availability
  if (httpMethod === 'GET') {
    const username = queryStringParameters.username;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ available: !users[username] })
    };
  }

  // POST: Login, Register, Update
  if (httpMethod === 'POST') {
    try {
      const { action, username, password, currentUsername, newUsername, oldPassword, newPassword } = JSON.parse(body);

      if (action === 'register') {
        if (users[username]) return { statusCode: 400, body: JSON.stringify({ message: '用户名已被占用' }) };
        users[username] = { username, password };
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ user: { username } })
        };
      }

      if (action === 'login') {
        const user = users[username];
        if (user && user.password === password) {
          return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ user: { username } })
          };
        }
        return { statusCode: 401, body: JSON.stringify({ message: '用户名或密码错误' }) };
      }

      if (action === 'update') {
        const user = users[currentUsername];
        if (!user || user.password !== oldPassword) {
          return { statusCode: 401, body: JSON.stringify({ message: '原密码验证失败' }) };
        }

        // Handle username change
        if (newUsername && newUsername !== currentUsername) {
          if (users[newUsername]) return { statusCode: 400, body: JSON.stringify({ message: '新用户名已被占用' }) };
          delete users[currentUsername];
          user.username = newUsername;
          users[newUsername] = user;
        }

        // Handle password change
        if (newPassword) {
          user.password = newPassword;
        }

        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ user: { username: user.username } })
        };
      }
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ message: 'Server Error' }) };
    }
  }

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

  return { statusCode: 405, body: 'Method Not Allowed' };
};
