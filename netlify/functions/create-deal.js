const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function generateSlug(address) {
  const base = address
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);
  const rand = Math.random().toString(36).substring(2, 7);
  return `${base}-${rand}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const {
      address,
      finance_type,
      loan_amount,
      security_value,
      rate_from,
      max_lvr,
      loan_term_months,
      establishment_fee_pct,
      line_fee_pct,
      context_note,
      broker_name,
      broker_phone,
    } = body;

    if (!address || !finance_type || !loan_amount || !rate_from || !max_lvr) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    const slug = generateSlug(address);

    // Fetch Google Maps satellite image URL
    const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
    const hero_image_url = googleMapsKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=17&size=800x400&maptype=satellite&key=${googleMapsKey}`
      : null;

    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        slug,
        address,
        finance_type,
        loan_amount,
        security_value,
        rate_from,
        max_lvr,
        loan_term_months: loan_term_months || 12,
        establishment_fee_pct: establishment_fee_pct || 0.01,
        line_fee_pct: line_fee_pct || 0,
        context_note,
        broker_name: broker_name || 'James Storey',
        broker_phone: broker_phone || '',
        broker_email: 'info@dealt.com.au',
        hero_image_url,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: deal.slug, id: deal.id })
    };

  } catch (err) {
    console.error('create-deal error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
