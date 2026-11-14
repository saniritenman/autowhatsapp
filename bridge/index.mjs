import {createClient} from '@supabase/supabase-js';
import {WhatsAppSession,Media as MessageMedia} from './session.mjs';
import QRCode from 'qrcode';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {createDispatcher} from '../supabase/functions/dispatch/core.ts';

const required=['SUPABASE_URL','SUPABASE_SECRET_KEY','AW_OWNER_ID'];
for(const k of required)if(!process.env[k])throw Error(`Missing ${k}`);
const owner=process.env.AW_OWNER_ID, instance=randomUUID();
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const live=process.env.ENABLE_LIVE_SEND==='true';
let client,ready=false,busy=false,stopping=false,heartbeat=0;
async function checked(query){const r=await query;if(r.error)throw r.error;return r.data;}
async function status(data){await checked(db.from('aw_connections').update({...data,heartbeat_at:new Date().toISOString(),sending_enabled:live&&ready}).eq('owner_id',owner).eq('instance_id',instance));}
async function lease(){return await checked(db.rpc('aw_web_lease',{account:owner,instance}));}
async function start(){
 if(client)return;
 await status({status:'starting',qr_data:null,qr_expires_at:null});
 client=new WhatsAppSession(process.env.SESSION_PATH||'./.wa-session',owner);
 client.on('qr',async value=>{ready=false;try{await status({status:'qr',qr_data:await QRCode.toDataURL(value,{width:320,margin:4}),qr_expires_at:new Date(Date.now()+45000).toISOString(),phone:null})}catch{console.error('Could not persist QR state')}});
 client.on('authenticated',()=>status({status:'starting',qr_data:null,qr_expires_at:null}).catch(()=>{}));
 client.on('ready',()=>{ready=true;status({status:'ready',qr_data:null,qr_expires_at:null,phone:client.info?.wid?.user||null}).catch(()=>{})});
 client.on('auth_failure',()=>{ready=false;status({status:'error',qr_data:null,qr_expires_at:null}).catch(()=>{})});
 client.on('disconnected',()=>{ready=false;status({status:'disconnected',qr_data:null,qr_expires_at:null}).catch(()=>{})});
 client.on('message_ack',async(message,ack)=>{const delivery=({1:'sent',2:'delivered',3:'read',4:'read'})[ack];if(!delivery)return;try{const p=await checked(db.from('aw_parts').select('id,delivery').eq('provider_id',message.id._serialized).maybeSingle());if(p){const rank={sent:1,delivered:2,read:3};if((rank[delivery]||0)>(rank[p.delivery]||0))await checked(db.from('aw_parts').update({delivery}).eq('id',p.id))}}catch{console.error('Could not store message acknowledgement')}});
 await client.initialize();
}
async function stop(logout=false){ready=false;const current=client;client=null;if(current){try{if(logout)await current.logout()}finally{await current.destroy().catch(()=>{})}}await status({status:'disconnected',qr_data:null,qr_expires_at:null,phone:null});}
const provider={ownerId:owner,
 async media(s){if(!s.attachment_path)return null;if(!s.attachment_path.startsWith(owner+'/'))throw Error('Attachment ownership mismatch');return {kind:s.attachment_type.startsWith('image/')?'image':s.attachment_type.startsWith('video/')?'video':s.attachment_type.startsWith('audio/')?'audio':'document',id:s.attachment_path,mime:s.attachment_type,name:s.attachment_name}},
 async send(phone,payload){
  if(!ready||!live)throw Error('WhatsApp bridge is not ready for live sending.');
  const id=await client.getNumberId(phone.slice(1));if(!id)return {ok:false,status:400,json:async()=>({error:{code:'NUMBER_NOT_ON_WHATSAPP'}})};
  let content,options={sendSeen:false};
  if(payload.type==='text')content=payload.text.body;
  else{const item=payload[payload.type];if(!item.id.startsWith(owner+'/'))throw Error('Attachment ownership mismatch');const blob=await checked(db.storage.from('autowhatsapp').download(item.id));content=new MessageMedia(blob.type,Buffer.from(await blob.arrayBuffer()).toString('base64'),item.filename||item.id.split('/').at(-1));if(payload.type==='document')options.sendMediaAsDocument=true;}
  // No automatic replay on timeouts: the provider may already have accepted the send.
  let timer;try{const msg=await Promise.race([client.sendMessage(id._serialized,content,options),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Sending outcome unknown')),45000)})]);return {ok:true,status:200,json:async()=>({messages:[{id:msg.id._serialized}]})}}finally{clearTimeout(timer)}
 }
};
const dispatch=createDispatcher(db,key=>process.env[key]||'',fetch,provider);
async function tick(){if(busy||stopping)return;busy=true;try{
 if(!await lease()){console.error('Another bridge holds this account lease. Exiting.');process.exitCode=1;await shutdown();return;}
 heartbeat=Date.now();
 const row=await checked(db.from('aw_connections').select('command,command_id,qr_expires_at').eq('owner_id',owner).single());
 if(row.command){
  await checked(db.from('aw_connections').update({command:null}).eq('owner_id',owner).eq('command_id',row.command_id));
  if(row.command==='disconnect')await stop(true);
  else if(!ready){await stop(false);await start();}
 }
 if(row.qr_expires_at&&Date.parse(row.qr_expires_at)<Date.now())await status({qr_data:null});
 await status({});if(ready&&live)await dispatch();
 }catch{console.error('Bridge cycle failed. Check service configuration and database connectivity.')}finally{busy=false}}
const interval=setInterval(tick,10000);
const leaseTimer=setInterval(async()=>{if(stopping)return;try{if(!await lease()){await shutdown();process.exitCode=1;return}heartbeat=Date.now();await status({})}catch{await shutdown();process.exitCode=1}},20000);
// Health endpoint exposes neither QR codes, credentials, phone number nor sessions.
const server=createServer((req,res)=>{if(req.url!=='/health'){res.writeHead(404);res.end();return}res.writeHead(Date.now()-heartbeat<90000?200:503,{'Content-Type':'application/json'});res.end(JSON.stringify({healthy:Date.now()-heartbeat<90000}))}).listen(Number(process.env.PORT||10000),'0.0.0.0');
async function shutdown(){if(stopping)return;stopping=true;clearInterval(interval);clearInterval(leaseTimer);await stop(false).catch(()=>{});await checked(db.from('aw_connections').update({lease_until:new Date().toISOString()}).eq('owner_id',owner).eq('instance_id',instance)).catch(()=>{});server.close();}
process.on('SIGTERM',()=>shutdown().then(()=>process.exit()));process.on('SIGINT',()=>shutdown().then(()=>process.exit()));
if(await lease()){heartbeat=Date.now();await start().catch(()=>console.error('Browser initialization failed. Check Chromium and persistent disk settings.'));await tick()}else{console.error('Only one bridge instance per account is supported.');await shutdown();process.exitCode=1;}
