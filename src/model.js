import {DateTime} from 'luxon';
export function validate(r,now=Date.now()){
 if(!/^\+[1-9]\d{7,14}$/.test(r.phone))throw Error('Use an international phone number, for example +972501234567.');
 if(!r.body?.trim()&&!r.attachments?.length)throw Error('Add a message or a file.');
 const d=DateTime.fromISO(r.local_time,{zone:r.timezone});
 if(!d.isValid||d.toFormat("yyyy-MM-dd'T'HH:mm")!==r.local_time)throw Error('Choose a valid date and time in this timezone.');
 if(d.toMillis()<=now)throw Error('Choose a future reminder time.');
 if(!['once','daily','weekly','weekdays'].includes(r.repeat))throw Error('Choose a valid recurrence.');
 if(r.repeat==='weekdays'&&(!r.weekdays?.length||!r.weekdays.includes(d.weekday)))throw Error('Choose weekdays including the first reminder date.');
 if(r.end_date&&r.end_date<d.toISODate())throw Error('End date must be on or after the first reminder.');
 return d.toUTC().toISO();
}
export function whatsappUrl(r){if(!/^\+[1-9]\d{7,14}$/.test(r.phone))throw Error('Invalid recipient');return 'https://wa.me/'+r.phone.slice(1)+'?text='+encodeURIComponent(r.body||'')}
export function calendarId(id){return 'a'+id.replaceAll('-','').toLowerCase()}
export function eventFor(r,site){
 const start=DateTime.fromISO(r.local_time,{zone:r.timezone});
 const link=site.split('#')[0]+'#reminder='+encodeURIComponent(r.id);
 const event={id:calendarId(r.id),summary:'WhatsApp · '+(r.contact_name||r.phone),description:'Open your saved message and attachments, then press Send yourself in WhatsApp.\n'+link,start:{dateTime:start.toISO(),timeZone:r.timezone},end:{dateTime:start.plus({minutes:5}).toISO(),timeZone:r.timezone},reminders:{useDefault:false,overrides:[{method:'popup',minutes:Number(r.reminder_minutes||0)}]},extendedProperties:{private:{autowhatsapp_id:r.id}},source:{title:'AutoWhatsApp',url:link}};
 if(r.repeat!=='once'){
  const days=['MO','TU','WE','TH','FR','SA','SU'];let rule=r.repeat==='daily'?'FREQ=DAILY':r.repeat==='weekly'?'FREQ=WEEKLY':'FREQ=WEEKLY;BYDAY='+r.weekdays.map(d=>days[d-1]).join(',');
  if(r.end_date)rule+=';UNTIL='+DateTime.fromISO(r.end_date,{zone:r.timezone}).endOf('day').toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");event.recurrence=['RRULE:'+rule];
 }
 return event;
}
export function nextOccurrence(r,now=Date.now()){
 let d=DateTime.fromISO(r.local_time,{zone:r.timezone});if(r.repeat==='once')return d.toUTC().toISO();
 const weekdays=r.weekdays||[];if(r.repeat==='weekdays'&&!weekdays.length)return null;let count=0;
 while(d.toMillis()<now){d=d.plus(r.repeat==='weekly'?{weeks:1}:{days:1});if(r.repeat==='weekdays'&&!weekdays.includes(d.weekday))continue;if(++count>40000)return null;}
 if(r.repeat==='weekdays'){let guard=0;while(!weekdays.includes(d.weekday)){d=d.plus({days:1});if(++guard>7)return null;}}
 if(r.end_date&&d.toISODate()>r.end_date)return null;return d.toUTC().toISO();
}
