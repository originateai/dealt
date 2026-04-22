const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const HUBSPOT_TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
const HUBSPOT_API = 'https://api.hubapi.com';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { deal_id, name, mobile, email, funding_table_requested, doc_urls, loan_type, loan_size, message, source } = body;

    if (!name || !mobile || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Build insert object — only include deal_id if it's a real UUID
    const insertData = {
      name,
      mobile,
      email,
      funding_table_requested: funding_table_requested || false,
      doc_urls: doc_urls || [],
      loan_type: loan_type || null,
      loan_size: loan_size || null,
      message: message || null,
      source: source || 'website',
      hubspot_synced: false,
      created_at: new Date().toISOString(),
    };

    if (deal_id && deal_id !== 'website-enquiry' && deal_id !== null) {
      insertData.deal_id = deal_id;
    }

    const { data: leadRecord, error: leadError } = await supabase
      .from('leads')
      .insert(insertData)
      .select()
      .single();

    if (leadError) throw leadError;

    // HubSpot sync (optional — skips if no token)
    if (HUBSPOT_TOKEN) {
      try {
        const props = {
          email: leadRecord.email,
          firstname: name.split(' ')[0],
          lastname: name.split(' ').slice(1).join(' ') || '',
          phone: mobile,
          hs_lead_status: 'NEW',
          lifecyclestage: 'lead',
        };

        const searchRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
            limit: 1,
          }),
        });

        const searchData = await searchRes.json();
        let contactId;

        if (searchData.total > 0) {
          contactId = searchData.results[0].id;
          await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/${contactId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties: props }),
          });
        } else {
          const cr = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties: props }),
          });
          const cd = await cr.json();
          contactId = cd.id;
        }

        // Create HubSpot deal
        const dealRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/deals`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            properties: {
              dealname: `${name} – ${loan_type || 'Website Enquiry'}`,
              amount: '',
              dealstage: 'appointmentscheduled',
              pipeline: 'default',
              closedate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
              description: `Source: ${source || 'website'}\nLoan Type: ${loan_type || ''}\nLoan Size: ${loan_size || ''}\nMessage: ${message || ''}`,
            }
          }),
        });

        const dealData = await dealRes.json();
        const hubspotDealId = dealData.id;

        if (contactId && hubspotDealId) {
          await fetch(`${HUBSPOT_API}/crm/v3/objects/deals/${hubspotDealId}/associations/contacts/${contactId}/deal_to_contact`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
          });
        }

        await supabase.from('leads')
          .update({ hubspot_synced: true, hubspot_contact_id: String(contactId), hubspot_deal_id: String(hubspotDealId) })
          .eq('id', leadRecord.id);

      } catch (hsErr) {
        console.error('HubSpot sync error (non-fatal):', hsErr);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, lead_id: leadRecord.id })
    };

  } catch (err) {
    console.error('submit-lead error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
