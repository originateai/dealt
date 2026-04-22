exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      supabaseUrl:  process.env.SUPABASE_URL,
      supabaseAnon: process.env.SUPABASE_ANON_KEY,
      googleMapsKey: process.env.GOOGLE_MAPS_API_KEY,
    })
  };
};
