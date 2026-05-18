const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.handler = async (event, context) => {
  const { httpMethod, body } = event;

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

  // GET: Fetch all scores
  if (httpMethod === 'GET') {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('username, mode_id, accuracy, avg_time, anti_index, date')
        .order('anti_index', { ascending: false });

      if (error) throw error;

      // Group scores by mode_id
      const groupedScores = data.reduce((acc, score) => {
        if (!acc[score.mode_id]) acc[score.mode_id] = [];
        acc[score.mode_id].push(score);
        return acc;
      }, {});

      // Keep only top 50 per mode
      Object.keys(groupedScores).forEach(modeId => {
        groupedScores[modeId] = groupedScores[modeId].slice(0, 50);
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(groupedScores)
      };
    } catch (e) {
      return { statusCode: 500, body: 'Internal Server Error' };
    }
  }

  // POST: Update scores for a user
  if (httpMethod === 'POST') {
    try {
      const { username, scores } = JSON.parse(body);
      
      if (!username || !scores) {
        return { statusCode: 400, body: 'Missing username or scores' };
      }

      // Update scores in Supabase
      for (const newScore of scores) {
        // Upsert logic: If user already has a score for this mode, check if new one is better
        const { data: existing } = await supabase
          .from('leaderboard')
          .select('id, anti_index')
          .eq('username', username)
          .eq('mode_id', newScore.modeId)
          .single();

        if (existing) {
          if (newScore.antiIndex > existing.anti_index) {
            await supabase
              .from('leaderboard')
              .update({
                accuracy: newScore.accuracy,
                avg_time: newScore.avgTime,
                anti_index: newScore.antiIndex,
                date: newScore.date
              })
              .eq('id', existing.id);
          }
        } else {
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
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Scores updated successfully' })
      };
    } catch (e) {
      return { statusCode: 500, body: 'Internal Server Error' };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
