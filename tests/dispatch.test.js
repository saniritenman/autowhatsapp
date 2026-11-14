import test from 'node:test';
import assert from 'node:assert/strict';
import {createDispatcher} from '../supabase/functions/dispatch/core.ts';
function harness({state='active',response=200,accepted=false,disabled=false,timeout=false}={}){
 const payload={id:'schedule',owner_id:'owner',phone:'+972501234567',consent:true,mode:'template',template_name:'reminder',language:'en_US',parameters:[],repeat:'once',timezone:'Asia/Jerusalem',local_time:'2026-11-14T09:00'};
 const job={id:'job',payload,scheduled_at:'2026-11-14T07:00:00Z',attempts:1};
 const part={id:'part',status:accepted?'accepted':'queued'};const updates=[];let calls=0,finished=0;
 const db={rpc:async(name)=>{if(name==='aw_claim')return {data:[job]};if(name==='aw_finish')finished++;return {data:null}},from(table){let op='select',data;const chain={select(){return chain},eq(){return chain},single(){return chain},maybeSingle(){return chain},upsert(){op='upsert';return chain},update(d){op='update';data=d;return chain},then(resolve){if(op==='update'){updates.push({table,...data});if(table==='aw_parts')Object.assign(part,data)}resolve({data:op==='select'?(table==='aw_schedules'?{state,next_at:job.scheduled_at}:part):null})}};return chain}};
 const env=k=>k==='ENABLE_LIVE_SEND'?(disabled?'false':'true'):'configured';
 const send=async()=>{calls++;if(timeout)throw Error('timeout');return {ok:response===200,status:response,json:async()=>response===200?{messages:[{id:'wamid.test'}]}:{error:{code:response}}}};
 return {run:createDispatcher(db,env,send),updates,get calls(){return calls},get finished(){return finished}};
}
test('disabled live-send switch makes no provider requests',async()=>{const h=harness({disabled:true});assert.deepEqual(await h.run(),{disabled:true});assert.equal(h.calls,0)});
test('cancelled schedule cannot send',async()=>{const h=harness({state:'cancelled'});await h.run();assert.equal(h.calls,0);assert.equal(h.updates[0].status,'cancelled')});
test('one-time success persists acceptance and completes',async()=>{const h=harness();await h.run();assert.equal(h.calls,1);assert.equal(h.finished,1);assert.ok(h.updates.some(x=>x.provider_id==='wamid.test'))});
test('already accepted parts are never resent',async()=>{const h=harness({accepted:true});await h.run();assert.equal(h.calls,0);assert.equal(h.finished,1)});
test('rate limiting queues a delayed retry',async()=>{const h=harness({response:429});await h.run();assert.ok(h.updates.some(x=>x.table==='aw_jobs'&&x.status==='queued'&&Date.parse(x.available_at)>Date.now()))});
test('definitive rejection fails, transport timeout is uncertain',async()=>{const h=harness({response:400});await h.run();assert.ok(h.updates.some(x=>x.table==='aw_jobs'&&x.status==='failed'));const t=harness({timeout:true});await t.run();assert.ok(t.updates.some(x=>x.table==='aw_jobs'&&x.status==='uncertain'))});
