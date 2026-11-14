import test from 'node:test';
import assert from 'node:assert/strict';
import {WhatsAppSession,Media} from './session.mjs';
const owner='10000000-0000-4000-8000-000000000001';
function session(){const s=new WhatsAppSession('./test-unused-session',owner);const calls=[];s.socket={async sendMessage(to,payload){calls.push({to,payload});return {key:{id:'mock-id'}}},async onWhatsApp(){return [{jid:'12025550199@s.whatsapp.net',exists:true}]},end(){}};return {s,calls};}
test('Hebrew text passes unchanged to the linked WhatsApp socket',async()=>{const {s,calls}=session();const text='שלום! תזכורת למחר';assert.deepEqual(await s.sendMessage('12025550199@s.whatsapp.net',text),{id:{_serialized:'mock-id'}});assert.deepEqual(calls[0].payload,{text})});
test('file bytes, mime type and Hebrew filenames survive transport',async()=>{const {s,calls}=session();await s.sendMessage('12025550199@s.whatsapp.net',new Media('application/pdf',Buffer.from('test pdf').toString('base64'),'תזכורת.pdf'),{sendMediaAsDocument:true});assert.equal(calls[0].payload.fileName,'תזכורת.pdf');assert.equal(calls[0].payload.document.toString(),'test pdf')});
test('international recipient is resolved using the linked account',async()=>{const {s}=session();assert.equal((await s.getNumberId('12025550199'))._serialized,'12025550199@s.whatsapp.net')});
test('a response without a provider id is an unknown result',async()=>{const {s}=session();s.socket.sendMessage=async()=>({});await assert.rejects(()=>s.sendMessage('recipient','hi'),/No message identifier/) });
test('session path cannot escape the persistent directory',()=>assert.throws(()=>new WhatsAppSession('./test-unused-session','../outside'),/Invalid session path/));
