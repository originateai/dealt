const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const slug = event.queryStringParameters?.slug;

  if (!slug) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing slug' }) };
  }

  try {
    const { data: deal, error } = await supabase
      .from('deals')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !deal) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Deal not found' }) };
    }

    // Track view
    await supabase.from('deal_views').insert({ deal_id: deal.id, viewed_at: new Date().toISOString() });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify(deal)
    };

  } catch (err) {
    console.error('get-deal error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
