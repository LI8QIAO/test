// This is a simple in-memory store for demo purposes.
// In a real production environment, you should connect to a database 
// (e.g., MongoDB, Supabase, or Upstash Redis).

let globalScores = {};

exports.handler = async (event, context) => {
  const { httpMethod, body } = event;

  // GET: Fetch all scores
  if (httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(globalScores)
    };
  }

  // POST: Update scores for a user
  if (httpMethod === 'POST') {
    try {
      const { username, scores } = JSON.parse(body);
      
      if (!username || !scores) {
        return { statusCode: 400, body: 'Missing username or scores' };
      }

      // Update global store
      scores.forEach(newScore => {
        const modeId = newScore.modeId;
        if (!globalScores[modeId]) globalScores[modeId] = [];
        
        // Remove existing score for this user in this mode if it exists
        globalScores[modeId] = globalScores[modeId].filter(s => s.username !== username);
        
        // Add new score
        globalScores[modeId].push(newScore);
        
        // Sort by antiIndex descending and keep top 50
        globalScores[modeId].sort((a, b) => b.antiIndex - a.antiIndex);
        globalScores[modeId] = globalScores[modeId].slice(0, 50);
      });

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Scores updated successfully' })
      };
    } catch (e) {
      return { statusCode: 500, body: 'Internal Server Error' };
    }
  }

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

  return { statusCode: 405, body: 'Method Not Allowed' };
};
