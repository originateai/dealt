const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);

    const { error } = await supabase
      .from('lender_registrations')
      .insert({
        company_name:  body.company_name,
        abn:           body.abn || null,
        lender_type:   body.lender_type,
        state:         body.state || null,
        first_name:    body.first_name,
        last_name:     body.last_name,
        email:         body.email,
        mobile:        body.mobile,
        min_loan:      body.min_loan || null,
        max_loan:      body.max_loan || null,
        loan_products: body.loan_products || [],
        notes:         body.notes || null,
        created_at:    new Date().toISOString(),
      });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('submit-lender error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
