import supabase from './db-client.js';

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const { fileName, fileBase64, contentType, memberId } = req.body;
    if(!fileName || !fileBase64) return res.status(400).json({error:'fileName and fileBase64 required'});
    const buffer = Buffer.from(fileBase64, 'base64');
    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const path = memberId ? `member_${memberId}/${safeName}` : `new/${safeName}`;
    const { error: upErr } = await supabase.storage.from('member-photos').upload(path, buffer, { contentType: contentType||'image/jpeg', upsert: true });
    if(upErr) throw upErr;
    const { data } = supabase.storage.from('member-photos').getPublicUrl(path);
    const publicUrl = data.publicUrl;
    // upsert into member_photos if we have memberId
    if(memberId){
      const mid = parseInt(memberId);
      // delete old to keep single latest (or keep history - we keep latest by ordering)
      // allow multiple but we will display latest, so just insert
      await supabase.from('member_photos').insert({ member_id: mid, photo_url: publicUrl });
    }
    return res.status(200).json({ url: publicUrl, path });
  }catch(err){
    console.error(err);
    return res.status(500).json({error:err.message});
  }
}
