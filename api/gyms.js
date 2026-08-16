import supabase from './db-client.js';
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method==='OPTIONS') return res.status(204).end();
  try{
    if(req.method==='GET'){
      const { owner_id } = req.query;
      let q = supabase.from('gyms').select('*').order('created_at',{ascending:true});
      if(owner_id) q = q.eq('owner_id', parseInt(owner_id));
      const { data, error } = await q;
      if(error) throw error;
      return res.status(200).json(data);
    }
    if(req.method==='POST'){
      const { owner_id, gym_name, address } = req.body;
      const { data, error } = await supabase.from('gyms').insert({ owner_id: parseInt(owner_id), gym_name, address: address||'' }).select().single();
      if(error) throw error;
      return res.status(201).json(data);
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(err){ console.error(err); return res.status(500).json({error:err.message}); }
}
