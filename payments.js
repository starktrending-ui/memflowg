import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { member_id, membership_id } = req.query;
      let query = supabase.from('payments').select('*').order('payment_date', { ascending: false });
      if (member_id) query = query.eq('member_id', parseInt(member_id));
      if (membership_id) query = query.eq('membership_id', parseInt(membership_id));
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { member_id, membership_id, amount, payment_method, payment_date, notes, type } = req.body;
      if (!member_id || !amount) return res.status(400).json({ error: 'member_id and amount required' });
      const { data, error } = await supabase.from('payments').insert({
        member_id: parseInt(member_id),
        membership_id: membership_id ? parseInt(membership_id) : null,
        amount: parseFloat(amount),
        payment_method: payment_method || 'cash',
        payment_date: payment_date ? new Date(payment_date).toISOString() : new Date().toISOString(),
        notes: notes || '',
        type: type || 'membership'
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      if (updates.amount != null) updates.amount = parseFloat(updates.amount);
      const { data, error } = await supabase.from('payments').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
