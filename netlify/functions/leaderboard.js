const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ymyyliwjztyggrhtnsii.supabase.co';
const SUPABASE_KEY = 'sb_secret_QQuHXBGgA0HhjC4u4mAa7g_7mssCope';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event, context) => {
  const { httpMethod, body } = event;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // GET: Fetch global scores for all modes
  if (httpMethod === 'GET') {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('anti_index', { ascending: false });

      if (error) throw error;

      // Group by modeId
      const groupedScores = data.reduce((acc, score) => {
        if (!acc[score.mode_id]) acc[score.mode_id] = [];
        acc[score.mode_id].push(score);
        return acc;
      }, {});

      // Limit each mode to top 50
      Object.keys(groupedScores).forEach(modeId => {
        groupedScores[modeId] = groupedScores[modeId].slice(0, 50);
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(groupedScores)
      };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ message: 'Error fetching scores' }) };
    }
  }

  // POST: Update scores for a user
  if (httpMethod === 'POST') {
    try {
      const { username, scores } = JSON.parse(body);
      
      if (!username || !scores) {
        return { statusCode: 400, headers, body: 'Missing username or scores' };
      }

      for (const newScore of scores) {
        // 1. Check if user already has a score for this mode
        const { data: existingScore } = await supabase
          .from('leaderboard')
          .select('*')
          .eq('username', username)
          .eq('mode_id', newScore.modeId)
          .single();

        if (existingScore) {
          // 2. Only update if the new antiIndex is higher
          if (newScore.antiIndex > existingScore.anti_index) {
            await supabase
              .from('leaderboard')
              .update({
                accuracy: newScore.accuracy,
                avg_time: newScore.avgTime,
                anti_index: newScore.antiIndex,
                date: newScore.date
              })
              .eq('id', existingScore.id);
          }
        } else {
          // 3. Insert new score record
          await supabase
            .from('leaderboard')
            .insert([{
              username,
              mode_id: newScore.modeId,
              accuracy: newScore.accuracy,
              avg_time: newScore.avgTime,
              anti_index: newScore.antiIndex,
              date: newScore.date
            }]);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Scores updated successfully' })
      };
    } catch (e) {
      console.error(e);
      return { statusCode: 500, headers, body: JSON.stringify({ message: 'Internal Server Error' }) };
    }
  }

  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};
