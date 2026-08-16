import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const [{ data: members, error: mErr }, { data: photos, error: pErr }] = await Promise.all([
        supabase.from('members').select('*').order('created_at', { ascending: false }),
        supabase.from('member_photos').select('*').order('created_at', { ascending: false })
      ]);
      if (mErr) throw mErr;
      // map latest photo per member
      const photoMap = {};
      (photos||[]).forEach(ph=>{ if(!photoMap[ph.member_id]) photoMap[ph.member_id]=ph.photo_url; });
      const enriched = (members||[]).map(m=>({ ...m, photo_url: photoMap[m.id] || null }));
      return res.status(200).json(enriched);
    }
    if (req.method === 'POST') {
      const { name, phone, email, gender, dob, join_date, notes, avatar_color, photo_url } = req.body;
      if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
      const base = { name, phone, email: email || null, gender: gender || 'other', dob: dob || null, join_date: join_date || new Date().toISOString(), notes: notes || null, avatar_color: avatar_color || '#111827' };
      // try insert with photo_url if column exists, otherwise without
      let member;
      try {
        const { data, error } = await supabase.from('members').insert({ ...base, photo_url: photo_url || null }).select().single();
        if(error) throw error;
        member = data;
      } catch(e){
        // fallback without photo_url column
        if(e.message && e.message.includes('photo_url')){
          const { data, error } = await supabase.from('members').insert(base).select().single();
          if(error) throw error;
          member = data;
        } else throw e;
      }
      if(photo_url && member){
        await supabase.from('member_photos').insert({ member_id: member.id, photo_url });
        member.photo_url = photo_url;
      }
      return res.status(201).json(member);
    }
    if (req.method === 'PUT') {
      const { id, photo_url, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      // clean undefined
      Object.keys(updates).forEach(k=> updates[k]===undefined && delete updates[k]);
      // try to update photo_url column if exists
      let finalUpdates = { ...updates };
      // include photo_url try, if fails fallback
      try{
        if(photo_url !== undefined) finalUpdates.photo_url = photo_url;
        const { data, error } = await supabase.from('members').update(finalUpdates).eq('id', id).select().single();
        if(error) throw error;
        if(photo_url){
          await supabase.from('member_photos').insert({ member_id: id, photo_url });
          data.photo_url = photo_url;
        } else {
          const { data: ph } = await supabase.from('member_photos').select('*').eq('member_id', id).order('created_at',{ascending:false}).limit(1);
          data.photo_url = ph && ph[0] ? ph[0].photo_url : null;
        }
        return res.status(200).json(data);
      }catch(e){
        if(e.message && e.message.includes('photo_url')){
          const { data, error } = await supabase.from('members').update(updates).eq('id', id).select().single();
          if(error) throw error;
          if(photo_url !== undefined && photo_url){
            await supabase.from('member_photos').insert({ member_id: id, photo_url });
            data.photo_url = photo_url;
          } else if(photo_url===null){
            await supabase.from('member_photos').delete().eq('member_id', id);
            data.photo_url = null;
          } else {
            const { data: ph } = await supabase.from('member_photos').select('*').eq('member_id', id).order('created_at',{ascending:false}).limit(1);
            data.photo_url = ph && ph[0] ? ph[0].photo_url : null;
          }
          return res.status(200).json(data);
        }
        throw e;
      }
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      await supabase.from('member_photos').delete().eq('member_id', id);
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) throw error;
      await supabase.from('memberships').delete().eq('member_id', id);
      await supabase.from('payments').delete().eq('member_id', id);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) { console.error(err); return res.status(500).json({ error: err.message }); }
}
