import test from 'node:test';
import assert from 'node:assert/strict';
import {DateTime} from 'luxon';
import {validate,eventFor,calendarId,whatsappUrl,nextOccurrence} from '../src/model.js';
import {calendarApi} from '../src/calendar-api.js';
const row={id:'15344c28-b6b2-4ffb-bbdb-5617c042502a',phone:'+972501234567',contact_name:'Test contact',body:'שלום! ☀ & hello',attachments:[],local_time:'2027-03-21T09:00',timezone:'Asia/Jerusalem',repeat:'once',weekdays:[1,3,5],end_date:null,reminder_minutes:15};
const site='https://saniritenman.github.io/autowhatsapp/';
test('one-time event, popup only, deep link without message/file disclosure',()=>{
 const event=eventFor(row,site);assert.equal(event.start.dateTime,'2027-03-21T09:00:00.000+02:00');
 assert.equal(event.start.timeZone,'Asia/Jerusalem');assert.equal(event.recurrence,undefined);
 assert.deepEqual(event.reminders,{useDefault:false,overrides:[{method:'popup',minutes:15}]});
 assert.ok(event.description.includes(site+'#reminder='+row.id));assert.ok(!event.description.includes(row.body));assert.equal(event.attendees,undefined);
 assert.match(calendarId(row.id),/^[0-9a-v]{5,1024}$/);
});
test('weekly recurrence retains wall-clock time across Jerusalem daylight savings',()=>{
 const r={...row,repeat:'weekly',end_date:'2027-04-30'};assert.match(eventFor(r,site).recurrence[0],/^RRULE:FREQ=WEEKLY;UNTIL=/);
 const next=DateTime.fromISO(nextOccurrence(r,DateTime.fromISO('2027-03-22T00:00',{zone:r.timezone}).toMillis())).setZone(r.timezone);
 assert.equal(next.toFormat('yyyy-MM-dd HH:mm ZZ'),'2027-03-28 09:00 +03:00');
});
test('selected weekdays, inclusive end date, and ended schedules',()=>{
 const r={...row,local_time:'2027-03-22T09:00',repeat:'weekdays',end_date:'2027-03-26'};
 assert.ok(validate(r,0));assert.match(eventFor(r,site).recurrence[0],/BYDAY=MO,WE,FR/);
 assert.equal(nextOccurrence(r,DateTime.fromISO('2027-03-27').toMillis()),null);
 assert.throws(()=>validate({...r,weekdays:[]},0),/weekdays/);
});
test('validation rejects past reminders, invalid phone, empty content, DST gap and invalid end date',()=>{
 assert.throws(()=>validate(row,Date.parse('2028-01-01')),/future/);
 assert.throws(()=>validate({...row,phone:'0501234567'},0),/international/);
 assert.throws(()=>validate({...row,body:''},0),/message or a file/);
 assert.throws(()=>validate({...row,local_time:'2027-03-26T02:30'},0),/valid date/);
 assert.throws(()=>validate({...row,end_date:'2027-01-01'},0),/End date/);
 assert.ok(validate({...row,body:'',attachments:[{name:'image.png'}]},0));
});
test('Hebrew WhatsApp text is encoded and recipient is international digits',()=>{
 const url=new URL(whatsappUrl(row));assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/972501234567');assert.equal(url.searchParams.get('text'),row.body);
});
const response=(status,data={})=>({status,ok:status>=200&&status<300,json:async()=>data});
test('retry after network ambiguity reuses same event ID and patches without duplicate event',async()=>{
 const calls=[];const client=calendarApi(()=> 'mock-token',()=>{},async(url,options)=>{calls.push({url,...options});if(options.method==='POST')return response(409);if(options.method==='GET')return response(200,{extendedProperties:{private:{autowhatsapp_id:row.id}}});return response(200,{id:calendarId(row.id)})});
 await client.sync(row,site);assert.deepEqual(calls.map(c=>c.method),['POST','GET','PATCH']);assert.equal(JSON.parse(calls[0].body).id,calendarId(row.id));assert.equal(calls[2].url.split('/').at(-1),calendarId(row.id));
});
test('editing recurring to one-time clears old recurrence',async()=>{
 let body;await calendarApi(()=> 'mock',()=>{},async(_,o)=>{body=JSON.parse(o.body);return response(200,{id:'existing'})}).sync({...row,calendar_event_id:'existing'},site);assert.deepEqual(body.recurrence,[]);
});
test('cancellation is idempotent and can clean up an ambiguously created event',async()=>{
 for(const code of [204,404,410]){let seen;const api=calendarApi(()=> 'mock',()=>{},async(u,o)=>{seen={u,o};return response(code)});await api.cancel(row);assert.equal(seen.o.method,'DELETE');assert.ok(seen.u.endsWith(calendarId(row.id)))}
});
test('authorization failures require reconnection; transient failures remain retryable',async()=>{
 let cleared=false;await assert.rejects(calendarApi(()=> 'mock',()=>{cleared=true},async()=>response(401)).sync(row,site),/Reconnect/);assert.ok(cleared);
 await assert.rejects(calendarApi(()=> 'mock',()=>{},async()=>response(503)).sync(row,site),/draft is saved/);
});
test('conflicting event owned by another app is not overwritten',async()=>{
 let count=0;await assert.rejects(calendarApi(()=> 'mock',()=>{},async()=>++count===1?response(409):response(200,{extendedProperties:{private:{autowhatsapp_id:'other'}}})).sync(row,site),/identity conflict/);assert.equal(count,2);
});
