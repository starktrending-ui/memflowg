import supabase from './db-client.js';
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method==='OPTIONS') return res.status(204).end();
  try{
    if(req.method==='GET'){
      const gymName = req.query.gym_name || null;
      let q = supabase.from('gym_subscriptions').select('*').order('id',{ascending:false});
      if (gymName) q = q.eq('gym_name', gymName);
      const { data, error } = await q.limit(1);
      if(error) throw error;
      const sub = data && data[0] ? data[0] : null;
      let invQ = supabase.from('subscription_invoices').select('*').order('invoice_date',{ascending:false});
      if (gymName) invQ = invQ.eq('gym_name', gymName);
      const { data: invocies } = await invQ;
      return res.status(200).json({ subscription: sub, invoices: invocies || [] });
    }
    if(req.method==='POST'){
      const { action, plan_type, gym_name, payment_method } = req.body;
      const gName = gym_name || 'Demo Gym';
      if(action==='start_trial'){
        const now = new Date();
        const ends = new Date(); ends.setDate(now.getDate()+7);
        const renewal = new Date(ends);
        // ensure only one active per gym
        const { data: exist } = await supabase.from('gym_subscriptions').select('*').eq('gym_name', gName).order('id',{ascending:false}).limit(1);
        if(exist && exist[0] && exist[0].status==='active'){
          return res.status(200).json(exist[0]); // already active, don't overwrite
        }
        // expire old trials for same gym
        await supabase.from('gym_subscriptions').update({status:'cancelled'}).eq('gym_name', gName).eq('status','trial');
        const { data, error } = await supabase.from('gym_subscriptions').insert({
          gym_name: gName,
          plan_name: 'Free Trial',
          plan_type: 'trial',
          price: 0,
          status: 'trial',
          trial_started_at: now.toISOString(),
          trial_ends_at: ends.toISOString(),
          renewal_date: renewal.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: ends.toISOString(),
          payment_method: 'trial'
        }).select().single();
        if(error) throw error;
        await supabase.from('subscription_invoices').insert({
          subscription_id: data.id,
          gym_name: gName,
          plan_name: 'Free Trial',
          amount: 0,
          status: 'free',
          payment_method: 'trial',
          invoice_date: now.toISOString()
        });
        return res.status(201).json(data);
      }
      if(action==='subscribe'){
        const isYearly = plan_type==='yearly';
        const price = isYearly ? 3499 : 399;
        const planName = isYearly ? 'Yearly Plan' : 'Monthly Plan';
        const now = new Date();
        const end = new Date();
        if(isYearly) end.setFullYear(now.getFullYear()+1);
        else end.setMonth(now.getMonth()+1);
        const renewal = new Date(end);
        await supabase.from('gym_subscriptions').update({status:'cancelled'}).eq('gym_name', gName);
        const { data, error } = await supabase.from('gym_subscriptions').insert({
          gym_name: gName,
          plan_name: planName,
          plan_type: plan_type,
          price,
          status: 'active',
          renewal_date: renewal.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
          payment_method: payment_method || 'upi',
          trial_started_at: now.toISOString(),
          trial_ends_at: null
        }).select().single();
        if(error) throw error;
        await supabase.from('subscription_invoices').insert({
          subscription_id: data.id,
          gym_name: data.gym_name,
          plan_name: planName,
          amount: price,
          status: 'paid',
          payment_method: payment_method || 'upi',
          invoice_date: now.toISOString()
        });
        return res.status(201).json(data);
      }
      if(action==='cancel'){
        await supabase.from('gym_subscriptions').update({status:'cancelled'}).eq('gym_name', gName).neq('status','cancelled');
        return res.status(200).json({ok:true});
      }
      return res.status(400).json({error:'unknown action'});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(err){ console.error(err); return res.status(500).json({error:err.message}); }
}
