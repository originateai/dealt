const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const HUBSPOT_TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
const HUBSPOT_API = 'https://api.hubapi.com';

async function upsertHubSpotContact(lead, deal) {
  const props = {
    email: lead.email,
    firstname: lead.name.split(' ')[0],
    lastname: lead.name.split(' ').slice(1).join(' ') || '',
    phone: lead.mobile,
    hs_lead_status: 'NEW',
    lifecyclestage: 'lead',
  };

  // Search for existing contact
  const searchRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }],
      limit: 1,
    }),
  });

  const searchData = await searchRes.json();
  let contactId;

  if (searchData.total > 0) {
    // Update existing
    contactId = searchData.results[0].id;
    await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: props }),
    });
  } else {
    // Create new
    const createRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: props }),
    });
    const createData = await createRes.json();
    contactId = createData.id;
  }

  return contactId;
}

async function createHubSpotDeal(lead, deal, contactId) {
  const loanFormatted = deal.loan_amount
    ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(deal.loan_amount)
    : '';

  const dealProps = {
    dealname: `${lead.name} – ${deal.address}`,
    amount: deal.loan_amount,
    dealstage: 'appointmentscheduled',
    pipeline: 'default',
    closedate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    description: `Finance Type: ${deal.finance_type}\nAddress: ${deal.address}\nLoan: ${loanFormatted}\nRate From: ${deal.rate_from}%\nMax LVR: ${deal.max_lvr}%\nFunding Table Requested: ${lead.funding_table_requested ? 'Yes' : 'No'}\nDocs Uploaded: ${lead.doc_urls?.length || 0}`,
  };

  const dealRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/deals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties: dealProps }),
  });

  const dealData = await dealRes.json();
  const hubspotDealId = dealData.id;

  // Associate contact with deal
  if (contactId && hubspotDealId) {
    await fetch(`${HUBSPOT_API}/crm/v3/objects/deals/${hubspotDealId}/associations/contacts/${contactId}/deal_to_contact`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
    });
  }

  return hubspotDealId;
}

async function addHubSpotNote(contactId, hubspotDealId, lead, deal) {
  const docNote = lead.doc_urls?.length
    ? `\n\nDocuments uploaded:\n${lead.doc_urls.join('\n')}`
    : '';

  const noteBody = `New lead from Dealt finance flyer\n\nProperty: ${deal.address}\nBroker: ${deal.broker_name}\nFunding table requested: ${lead.funding_table_requested ? 'Yes' : 'No'}${docNote}`;

  await fetch(`${HUBSPOT_API}/crm/v3/objects/notes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        hs_note_body: noteBody,
        hs_timestamp: new Date().toISOString(),
      },
      associations: [
        ...(contactId ? [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }] : []),
        ...(hubspotDealId ? [{ to: { id: hubspotDealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] }] : []),
      ],
    }),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { deal_id, name, mobile, email, funding_table_requested, doc_urls } = body;

    if (!name || !mobile || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Get deal details only if deal_id provided
    let deal = null;
    if (deal_id && deal_id !== 'website-enquiry') {
      const { data: dealData } = await supabase
        .from('deals')
        .select('*')
        .eq('id', deal_id)
        .single();
      deal = dealData;
    }

    // Save lead to Supabase
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        deal_id,
        name,
        mobile,
        email,
        funding_table_requested: funding_table_requested || false,
        doc_urls: doc_urls || [],
        hubspot_synced: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (leadError) throw leadError;

    // HubSpot sync
    let contactId = null;
    let hubspotDealId = null;

    if (HUBSPOT_TOKEN) {
      try {
        contactId = await upsertHubSpotContact(lead, deal);
        hubspotDealId = await createHubSpotDeal(lead, deal, contactId);
        await addHubSpotNote(contactId, hubspotDealId, lead, deal);

        // Mark as synced
        await supabase
          .from('leads')
          .update({ hubspot_synced: true, hubspot_contact_id: contactId, hubspot_deal_id: hubspotDealId })
          .eq('id', lead.id);
      } catch (hsErr) {
        console.error('HubSpot sync error (non-fatal):', hsErr);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, lead_id: lead.id })
    };

  } catch (err) {
    console.error('submit-lead error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
