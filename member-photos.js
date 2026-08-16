import supabase from './db-client.js';
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method==='OPTIONS') return res.status(204).end();
  try{
    const { member_id } = req.query;
    let q = supabase.from('member_photos').select('*').order('created_at',{ascending:false});
    if(member_id) q = q.eq('member_id', parseInt(member_id));
    const { data, error } = await q;
    if(error) throw error;
    return res.status(200).json(data||[]);
  }catch(err){ console.error(err); return res.status(500).json({error:err.message}); }
}
