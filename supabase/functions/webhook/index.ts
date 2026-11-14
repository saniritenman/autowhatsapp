import {createClient} from '@supabase/supabase-js';
const env=(s:string)=>Deno.env.get(s)||'';
const db=createClient(env('SUPABASE_URL'),(env('SUPABASE_SECRET_KEYS') ? JSON.parse(env('SUPABASE_SECRET_KEYS')).default : env('SUPABASE_SERVICE_ROLE_KEY')));
async function check(q:any){const r=await q;if(r.error)throw r.error;return r.data;}
async function signed(raw:string,signature:string){
 if(!env('META_APP_SECRET'))return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env('META_APP_SECRET')),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)));
 const expected='sha256='+Array.from(mac).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(expected.length!==signature.length)return false;
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);return diff===0;
}
Deno.serve(async(req)=>{
 const u=new URL(req.url);
 if(req.method==='GET')return env('META_VERIFY_TOKEN')&&u.searchParams.get('hub.mode')==='subscribe'&&u.searchParams.get('hub.verify_token')===env('META_VERIFY_TOKEN')?new Response(u.searchParams.get('hub.challenge')):new Response('Forbidden',{status:403});
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const raw=await req.text();if(!await signed(raw,req.headers.get('x-hub-signature-256')||''))return new Response('Invalid signature',{status:401});
 try{
  const body=JSON.parse(raw);
  for(const entry of body.entry||[])for(const c of entry.changes||[]){
   const v=c.value;if(v.metadata?.phone_number_id!==env('META_PHONE_NUMBER_ID'))continue;
   for(const m of v.messages||[]){
    const id='inbound:'+m.id;
    if(await check(db.from('aw_events').select('id').eq('id',id).maybeSingle()))continue;
    // Keep the newest timestamp even when events arrive out of order.
    const when=new Date(Number(m.timestamp)*1000).toISOString();
    if(Date.parse(when)>Date.now()+300000)continue;
    await check(db.from('aw_windows').upsert({phone:'+'+m.from,last_inbound:when},{onConflict:'phone',ignoreDuplicates:true}));
    await check(db.from('aw_windows').update({last_inbound:when}).eq('phone','+'+m.from).lt('last_inbound',when));
    await check(db.from('aw_events').upsert({id}));
   }
   for(const s of v.statuses||[]){
    const id=`status:${s.id}:${s.status}:${s.timestamp}`;
    if(await check(db.from('aw_events').select('id').eq('id',id).maybeSingle()))continue;
    let part=await check(db.from('aw_parts').select('*').eq('provider_id',s.id).maybeSingle());
    if(!part&&s.biz_opaque_callback_data)part=await check(db.from('aw_parts').select('*').eq('id',s.biz_opaque_callback_data).maybeSingle());
    if(part){
     const rank={sent:1,delivered:2,read:3};
     if(s.status==='failed'||(rank[s.status]||0)>(rank[part.delivery]||0))await check(db.from('aw_parts').update({provider_id:s.id,delivery:s.status,error:s.status==='failed'?`Delivery failed (${s.errors?.[0]?.code||'unknown'}).`:null}).eq('id',part.id));
    }
    await check(db.from('aw_events').upsert({id}));
   }
  }
  return new Response('OK');
 }catch{return new Response('Webhook could not be persisted',{status:500})}
});
