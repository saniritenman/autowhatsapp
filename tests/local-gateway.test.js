import test from 'node:test';
import assert from 'node:assert/strict';
import {createGateway,validFile} from '../supabase/functions/local-gateway/handler.ts';
const owner='10000000-0000-4000-8000-000000000001';
const token='a'.repeat(64);
const request=(body,secret=token)=>new Request('https://local.test',{method:'POST',headers:{'x-aw-computer-token':secret},body:JSON.stringify(body)});
function backend(identity=owner){const calls=[];return {calls,db:{rpc:async(name,args)=>{calls.push({name,args});return {data:name==='aw_computer_owner'?identity:[],error:null}},from(){throw Error('No table access expected')},storage:{from(){throw Error('No storage access expected')}}}}}
test('gateway rejects absent, malformed and revoked tokens',async()=>{for(const value of ['', 'short']){const b=backend();assert.equal((await createGateway(b.db)(request({op:'identity'},value))).status,401);assert.equal(b.calls.length,0)}const b=backend(null);assert.equal((await createGateway(b.db)(request({op:'identity'}))).status,401)});
test('token identity alone determines the worker owner',async()=>{const b=backend();const r=await createGateway(b.db)(request({op:'identity',owner_id:'other'}));assert.equal((await r.json()).data,owner)});
test('gateway rejects other-owner queue claims and unrestricted RPCs',async()=>{const b=backend();for(const body of [{op:'rpc',name:'aw_claim_web',args:{account:'other'}},{op:'rpc',name:'aw_claim',args:{}}])assert.equal((await createGateway(b.db)(request(body))).status,400);assert.ok(b.calls.every(c=>c.name==='aw_computer_owner'))});
test('private media paths reject traversal, encoding and other accounts',()=>{const valid=owner+'/20000000-0000-4000-8000-000000000001/file.pdf';assert.ok(validFile(owner,valid));for(const path of ['other/a/file.pdf',owner+'/../other/file.pdf',owner+'/%2e%2e/file.pdf',owner+'/20000000-0000-4000-8000-000000000001/..'])assert.equal(validFile(owner,path),false)});
test('gateway allows only the scoped personal queue',async()=>{const b=backend();const r=await createGateway(b.db)(request({op:'rpc',name:'aw_claim_web',args:{account:owner}}));assert.equal(r.status,200);assert.deepEqual(b.calls.at(-1),{name:'aw_claim_web',args:{account:owner}})});
test('gateway rejects arbitrary tables and owner-reassignment filters',async()=>{const b=backend();for(const body of [{op:'table',table:'auth.users',action:'select'},{op:'table',table:'aw_jobs',action:'select',filters:{owner_id:'other'}}])assert.equal((await createGateway(b.db)(request(body))).status,400)});
