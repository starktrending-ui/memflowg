import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const [{ data: members }, { data: memberships }, { data: payments }, { data: plans }] = await Promise.all([
      supabase.from('members').select('*'),
      supabase.from('memberships').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('membership_plans').select('*')
    ]);
    const today = new Date();
    const todayTs = today.getTime();
    const in7days = new Date(); in7days.setDate(today.getDate() + 7);
    // unique latest membership per member
    const latestMap = {};
    (memberships || []).forEach(m => {
      const ex = latestMap[m.member_id];
      if (!ex || new Date(m.end_date) > new Date(ex.end_date)) latestMap[m.member_id] = m;
    });
    const latest = Object.values(latestMap);
    let active = 0, expiring = 0, expired = 0;
    latest.forEach(m => {
      const end = new Date(m.end_date).getTime();
      if (end < todayTs) expired++;
      else if (end <= in7days.getTime()) { expiring++; active++; }
      else active++;
    });
    const totalRevenue = (payments || []).reduce((s,p)=> s + parseFloat(p.amount), 0);
    const thisMonth = (payments || []).filter(p=> { const d=new Date(p.payment_date); return d.getMonth()===today.getMonth() && d.getFullYear()===today.getFullYear(); }).reduce((s,p)=> s+parseFloat(p.amount),0);
    // dues
    let totalDue = 0;
    latest.forEach(mem => {
      const relatedPayments = (payments || []).filter(p=> p.membership_id===mem.id);
      const paid = relatedPayments.reduce((s,p)=> s+parseFloat(p.amount),0);
      const due = parseFloat(mem.price) - paid;
      if (due>0) totalDue+=due;
    });
    return res.status(200).json({
      totalMembers: members?.length || 0,
      active,
      expiring,
      expired,
      noMembership: (members?.length || 0) - latest.length,
      totalRevenue,
      thisMonthRevenue: thisMonth,
      totalDue,
      totalPlans: plans?.length || 0,
      totalMemberships: memberships?.length || 0,
      latestMemberships: latest.slice(0,20)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
