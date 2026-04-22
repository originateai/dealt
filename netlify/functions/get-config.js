exports.handler = async (event) => {
  // Only serve config to same-origin requests
  const origin = event.headers.origin || event.headers.referer || '';

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify({
      supabaseUrl:  process.env.SUPABASE_URL,
      supabaseAnon: process.env.SUPABASE_ANON_KEY,
    })
  };
};
