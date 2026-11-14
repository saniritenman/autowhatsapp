import baileys from '@whiskeysockets/baileys';
import {useMultiFileAuthState,DisconnectReason} from '@whiskeysockets/baileys';
import {EventEmitter} from 'node:events';
import {resolve,join,sep} from 'node:path';
import {rm} from 'node:fs/promises';
const makeSocket=typeof baileys==='function'?baileys:baileys.default;
const silent={level:'silent',child(){return this},trace(){},debug(){},info(){},warn(){},error(){},fatal(){}};
export class Media {constructor(mime,data,name){Object.assign(this,{mime,data,name})}}
export class WhatsAppSession extends EventEmitter {
 constructor(root,owner){super();this.root=resolve(root);this.directory=join(this.root,owner);if(!this.directory.startsWith(this.root+sep))throw Error('Invalid session path');this.stopped=false;this.retries=0;this.saves=Promise.resolve();}
 async initialize(){
  this.stopped=false;
  const {state,saveCreds}=await useMultiFileAuthState(this.directory);
  if(this.stopped)return;
  const socket=makeSocket({auth:state,logger:silent,printQRInTerminal:false,markOnlineOnConnect:false,syncFullHistory:false,shouldSyncHistoryMessage:()=>false,browser:['AutoWhatsApp','Chrome','1.0.0'],connectTimeoutMs:30000,defaultQueryTimeoutMs:30000});
  this.socket=socket;
  socket.ev.on('creds.update',()=>{if(!this.stopped)this.saves=this.saves.then(saveCreds).catch(()=>this.emit('auth_failure'));});
  socket.ev.on('connection.update',async({connection,lastDisconnect,qr})=>{
   if(this.stopped||this.socket!==socket)return;
   if(qr)this.emit('qr',qr);
   if(connection==='open'){this.retries=0;this.info={wid:{user:socket.user?.id?.split(':')[0]?.split('@')[0]}};this.emit('ready');}
   if(connection==='close'){
    this.emit('disconnected');
    if(lastDisconnect?.error?.output?.statusCode===DisconnectReason.loggedOut){this.stopped=true;await this.saves;await rm(this.directory,{recursive:true,force:true});return;}
    const delay=Math.min(30000,1000*2**Math.min(this.retries++,5));
    this.timer=setTimeout(()=>this.initialize().catch(()=>this.emit('auth_failure')),delay);
   }
  });
  socket.ev.on('messages.update',updates=>{for(const {key,update} of updates){if(key.fromMe&&update.status)this.emit('message_ack',{id:{_serialized:key.id}},({2:1,3:2,4:3,5:4})[update.status]||0)}});
 }
 async getNumberId(number){const results=await this.socket.onWhatsApp(number);const match=results?.find(x=>x.exists);return match?{_serialized:match.jid}:null;}
 async sendMessage(jid,content,options={}){
  let payload=typeof content==='string'?{text:content}:null;
  if(content instanceof Media){const data=Buffer.from(content.data,'base64');const kind=options.sendMediaAsDocument?'document':content.mime.startsWith('image/')?'image':content.mime.startsWith('video/')?'video':content.mime.startsWith('audio/')?'audio':'document';payload={[kind]:data,mimetype:content.mime,...(kind==='document'?{fileName:content.name}:{})};}
  if(!payload)throw Error('Unsupported message content');
  const sent=await this.socket.sendMessage(jid,payload);if(!sent?.key?.id)throw Error('No message identifier returned');return {id:{_serialized:sent.key.id}};
 }
 async logout(){this.stopped=true;clearTimeout(this.timer);try{await this.socket?.logout()}finally{await this.saves;await rm(this.directory,{recursive:true,force:true})}}
 async destroy(){this.stopped=true;clearTimeout(this.timer);this.socket?.end(Error('Service shutdown'));await this.saves;}
}
