const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    // Get deals with lead count
    const { data: deals, error } = await supabase
      .from('deals')
      .select(`
        id, slug, address, finance_type, loan_amount, security_value,
        rate_from, max_lvr, is_active, broker_name, created_at,
        leads(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const dealsWithCount = deals.map(d => ({
      ...d,
      leads_count: d.leads?.[0]?.count || 0,
      leads: undefined,
    }));

    // Stats
    const { count: totalLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });

    const { count: totalDocs } = await supabase
      .from('leads')
      .select('doc_urls', { count: 'exact', head: true })
      .neq('doc_urls', '[]');

    const { count: hubspotSynced } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('hubspot_synced', true);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deals: dealsWithCount,
        stats: {
          active_deals: dealsWithCount.filter(d => d.is_active).length,
          total_leads: totalLeads || 0,
          total_docs: totalDocs || 0,
          hubspot_synced: hubspotSynced || 0,
        }
      })
    };

  } catch (err) {
    console.error('list-deals error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
