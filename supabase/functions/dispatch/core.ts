import {nextOccurrence,occurrence} from '../_shared/schedule.js';
export function createDispatcher(db:any,env:(s:string)=>string,fetch:any){
async function checked(p:any){const r=await p;if(r.error)throw r.error;return r.data;}
const update=(table:string,id:string,data:any)=>checked(db.from(table).update(data).eq('id',id));
function mediaType(mime:string){return mime.startsWith('image/')?'image':mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':'document'}
async function media(s:any){
 if(!s.attachment_path)return null;
 if(!s.attachment_path.startsWith(s.owner_id+'/'))throw Error('Invalid attachment ownership');
 const blob=await checked(db.storage.from('autowhatsapp').download(s.attachment_path));
 const form=new FormData();form.set('messaging_product','whatsapp');form.set('file',blob,s.attachment_name);
 const r=await fetch(`https://graph.facebook.com/${env('META_API_VERSION')}/${env('META_PHONE_NUMBER_ID')}/media`,{method:'POST',headers:{Authorization:`Bearer ${env('META_ACCESS_TOKEN')}`},body:form,signal:AbortSignal.timeout(30000)});
 const body=await r.json();if(!r.ok||!body.id)throw Error('Media upload rejected; check file type and provider configuration.');
 return {kind:mediaType(s.attachment_type),id:body.id};
}
async function dispatch(){
 if(env('ENABLE_LIVE_SEND')!=='true')return {disabled:true};
 for(const key of ['META_API_VERSION','META_PHONE_NUMBER_ID','META_ACCESS_TOKEN'])if(!env(key))throw Error('Missing '+key);
 const claimed=await checked(db.rpc('aw_claim'));let sent=0;
 for(const job of claimed){
  const s=job.payload;let inFlight=false;
  try{
   const current=await checked(db.from('aw_schedules').select('state,next_at').eq('id',s.id).single());
   if(current.state!=='active'||Date.parse(current.next_at)!==Date.parse(job.scheduled_at)){await update('aw_jobs',job.id,{status:'cancelled'});continue;}
   if(!s.consent)throw Error('Recipient permission is missing.');
   occurrence(s.local_time,s.timezone);
   if(s.mode!=='template'){
    const w=await checked(db.from('aw_windows').select('last_inbound').eq('phone',s.phone).maybeSingle());
    if(!w||Date.now()-Date.parse(w.last_inbound)>=86400000)throw Error('The 24-hour reply window is closed. Use an approved template.');
   }
   const attachment=await media(s);const payloads:any[]=[];
   if(s.mode==='template'){
    if(attachment?.kind==='audio')throw Error('Audio template headers are unsupported.');
    const components:any[]=[];
    if(attachment)components.push({type:'header',parameters:[{type:attachment.kind,[attachment.kind]:{id:attachment.id}}]});
    if(s.parameters?.length)components.push({type:'body',parameters:s.parameters.map((text:string)=>({type:'text',text}))});
    payloads.push({type:'template',template:{name:s.template_name,language:{code:s.language},components}});
   }else{
    if(s.body?.trim())payloads.push({type:'text',text:{body:s.body}});
    if(attachment)payloads.push({type:attachment.kind,[attachment.kind]:{id:attachment.id,...(attachment.kind==='document'?{filename:s.attachment_name}:{})}});
   }
   if(!payloads.length)throw Error('Empty message');
   let held=false;
   for(let i=0;i<payloads.length;i++){
    await checked(db.from('aw_parts').upsert({job_id:job.id,ordinal:i},{onConflict:'job_id,ordinal',ignoreDuplicates:true}));
    const p=await checked(db.from('aw_parts').select('*').eq('job_id',job.id).eq('ordinal',i).single());
    if(p.status==='accepted')continue;
    if(p.status!=='queued')throw Error('Message part requires manual review.');
    await update('aw_parts',p.id,{status:'sending'});inFlight=true;
    const r=await fetch(`https://graph.facebook.com/${env('META_API_VERSION')}/${env('META_PHONE_NUMBER_ID')}/messages`,{method:'POST',headers:{Authorization:`Bearer ${env('META_ACCESS_TOKEN')}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:s.phone.slice(1),biz_opaque_callback_data:p.id,...payloads[i]}),signal:AbortSignal.timeout(30000)});
    const body=await r.json();
    if(!r.ok){
     // 5xx outcomes can be ambiguous. Never auto-replay them.
     if(r.status>=500)throw Error('WhatsApp server outcome unknown.');
     inFlight=false;
     const reason=`WhatsApp rejected message (${body.error?.code||r.status}).`;
     await update('aw_parts',p.id,{status:'failed',error:reason});
     const retry=r.status===429&&job.attempts<5;
     if(retry)await update('aw_parts',p.id,{status:'queued'});
     await update('aw_jobs',job.id,{status:retry?'queued':'failed',error:reason,available_at:new Date(Date.now()+Math.min(3600000,60000*2**job.attempts)).toISOString()});held=true;break;
    }
    if(!body.messages?.[0]?.id)throw Error('WhatsApp response did not confirm a message identifier.');
    await update('aw_parts',p.id,{status:'accepted',provider_id:body.messages[0].id});inFlight=false;
   }
   if(held)continue;
   let following=nextOccurrence(s,job.scheduled_at);let guard=0;
   while(following&&Date.parse(following)<=Date.now()){
    following=nextOccurrence(s,following);if(++guard>100000)throw Error('Schedule too far overdue; edit the start date.');
   }
   await checked(db.rpc('aw_finish',{jid:job.id,following}));sent++;
  }catch(e){await update('aw_jobs',job.id,{status:inFlight?'uncertain':'failed',error:inFlight?'Sending outcome unknown. Check WhatsApp before resending.':String(e.message||e).slice(0,300)});}
 }
 return {claimed:claimed.length,sent};
}

return dispatch;
}
