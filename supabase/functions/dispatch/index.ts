import {createClient} from '@supabase/supabase-js';
import {createDispatcher} from './core.ts';
const env=(s:string)=>Deno.env.get(s)||'';
const db=createClient(env('SUPABASE_URL'),(env('SUPABASE_SECRET_KEYS') ? JSON.parse(env('SUPABASE_SECRET_KEYS')).default : env('SUPABASE_SERVICE_ROLE_KEY')));
const dispatch=createDispatcher(db,env,fetch);
Deno.serve(async(req)=>{
 const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
 const authorized=env('AW_CRON_SECRET')? token===env('AW_CRON_SECRET') : token && (await db.rpc('aw_authorize_worker',{candidate:token})).data===true;
 if(!authorized)return new Response('Unauthorized',{status:401});
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 try{return Response.json(await dispatch())}catch{return Response.json({error:'Dispatch failed. Check database and worker configuration.'},{status:500})}
});
