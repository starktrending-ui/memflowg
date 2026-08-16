import supabase from './db-client.js';
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method==='OPTIONS') return res.status(204).end();
  try{
    if(req.method==='POST'){
      const { action, email, phone, password, owner_name, gym_name, owner_id } = req.body;
      if(action==='signup'){
        if(!owner_name || !password || (!email && !phone) || !gym_name) return res.status(400).json({error:'Missing fields: owner_name, gym_name, contact, password'});
        // check existing
        if(email){
          const { data: exist } = await supabase.from('gym_owners').select('*').eq('email', email).limit(1);
          if(exist && exist[0]) return res.status(409).json({error:'Email already registered. Please log in.'});
        }
        const { data: owner, error: e1 } = await supabase.from('gym_owners').insert({ owner_name, email: email||null, phone: phone||null, password }).select().single();
        if(e1) throw e1;
        const { data: gymRow, error: e2 } = await supabase.from('gyms').insert({ owner_id: owner.id, gym_name, address: '' }).select().single();
        if(e2) throw e2;
        // create trial subscription for this gym
        const now=new Date(); const ends=new Date(); ends.setDate(now.getDate()+7);
        await supabase.from('gym_subscriptions').insert({
          gym_name: gymRow.gym_name,
          plan_name: 'Free Trial',
          plan_type: 'trial',
          price: 0,
          status: 'trial',
          trial_started_at: now.toISOString(),
          trial_ends_at: ends.toISOString(),
          renewal_date: ends.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: ends.toISOString(),
          payment_method: 'trial'
        });
        // return combined
        const { data: gyms } = await supabase.from('gyms').select('*').eq('owner_id', owner.id);
        return res.status(201).json({ owner, gyms });
      }
      if(action==='login'){
        if(!password || (!email && !phone)) return res.status(400).json({error:'Enter email/phone and password'});
        let q = supabase.from('gym_owners').select('*');
        if(email) q = q.eq('email', email);
        else q = q.eq('phone', phone);
        const { data } = await q.limit(1);
        const owner = data && data[0];
        if(!owner) return res.status(404).json({error:'Account not found. Please sign up.'});
        if(owner.password !== password) return res.status(401).json({error:'Incorrect password'});
        const { data: gyms } = await supabase.from('gyms').select('*').eq('owner_id', owner.id);
        return res.status(200).json({ owner, gyms });
      }
      if(action==='register_gym'){
        if(!owner_id || !gym_name) return res.status(400).json({error:'owner_id and gym_name required'});
        const { data: gymRow, error } = await supabase.from('gyms').insert({ owner_id: parseInt(owner_id), gym_name, address: '' }).select().single();
        if(error) throw error;
        // trial subscription for this gym
        const now=new Date(); const ends=new Date(); ends.setDate(now.getDate()+7);
        // if gym already has sub keep first? check
        const { data: existSub } = await supabase.from('gym_subscriptions').select('*').eq('gym_name', gymRow.gym_name).limit(1);
        if(!existSub || !existSub[0]){
          await supabase.from('gym_subscriptions').insert({
            gym_name: gymRow.gym_name,
            plan_name: 'Free Trial',
            plan_type: 'trial',
            price: 0,
            status: 'trial',
            trial_started_at: now.toISOString(),
            trial_ends_at: ends.toISOString(),
            renewal_date: ends.toISOString(),
            current_period_start: now.toISOString(),
            current_period_end: ends.toISOString(),
            payment_method: 'trial'
          });
        }
        const { data: gyms } = await supabase.from('gyms').select('*').eq('owner_id', parseInt(owner_id));
        return res.status(201).json({ gym: gymRow, gyms });
      }
      return res.status(400).json({error:'unknown action'});
    }
    if(req.method==='GET'){
      const { owner_id } = req.query;
      if(!owner_id) return res.status(400).json({error:'owner_id required'});
      const { data: owner } = await supabase.from('gym_owners').select('*').eq('id', parseInt(owner_id)).single();
      const { data: gyms } = await supabase.from('gyms').select('*').eq('owner_id', parseInt(owner_id));
      return res.status(200).json({ owner, gyms: gyms||[] });
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(err){ console.error(err); return res.status(500).json({error:err.message}); }
}
