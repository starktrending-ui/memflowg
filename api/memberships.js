import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { member_id } = req.query;
      let query = supabase.from('memberships').select('*').order('start_date', { ascending: false });
      if (member_id) query = query.eq('member_id', parseInt(member_id));
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { member_id, plan_id, plan_name, start_date, duration_days, price, custom_price } = req.body;
      if (!member_id || !duration_days) return res.status(400).json({ error: 'member_id and duration_days required' });
      const sDate = start_date ? new Date(start_date) : new Date();
      const eDate = new Date(sDate);
      eDate.setDate(eDate.getDate() + parseInt(duration_days) - 1);
      const { data, error } = await supabase.from('memberships').insert({
        member_id: parseInt(member_id),
        plan_id: plan_id ? parseInt(plan_id) : null,
        plan_name: plan_name || 'Custom Plan',
        start_date: sDate.toISOString(),
        end_date: eDate.toISOString(),
        duration_days: parseInt(duration_days),
        price: custom_price != null ? parseFloat(custom_price) : (price != null ? parseFloat(price) : 0),
        status: 'active'
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      if (updates.price != null) updates.price = parseFloat(updates.price);
      if (updates.duration_days) updates.duration_days = parseInt(updates.duration_days);
      const { data, error } = await supabase.from('memberships').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      const { error } = await supabase.from('memberships').delete().eq('id', id);
      if (error) throw error;
      await supabase.from('payments').delete().eq('membership_id', id);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
