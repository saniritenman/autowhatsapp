import { DateTime } from 'luxon';
export function occurrence(local, zone) {
 let d = DateTime.fromISO(local,{zone});
 if(!d.isValid || d.toFormat("yyyy-MM-dd'T'HH:mm") !== local) throw Error('This local time does not exist in the selected timezone.');
 d=d.getPossibleOffsets().sort((a,b)=>a.toMillis()-b.toMillis())[0];
 return d.toUTC().toISO();
}
export function nextOccurrence(s, after) {
 if(s.repeat==='once') return null;
 const original=DateTime.fromISO(s.local_time,{zone:s.timezone});
 let d=DateTime.fromISO(after,{zone:'utc'}).setZone(s.timezone);
 const clock={hour:original.hour,minute:original.minute,second:0,millisecond:0};
 if(s.repeat==='interval') d=d.plus({minutes:s.interval_minutes});
 else if(s.repeat==='daily') d=d.plus({days:1}).set(clock);
 else if(s.repeat==='weekly') d=d.plus({weeks:1}).set(clock);
 else { do { d=d.plus({days:1}).set(clock); } while(!s.weekdays.includes(d.weekday)); }
 if(s.end_date && d.toISODate()>s.end_date) return null;
 return d.toUTC().toISO();
}
export function validate(s, now=Date.now()) {
 if(!/^\+[1-9]\d{7,14}$/.test(s.phone)) throw Error('Use an international number, such as +972501234567.');
 if(!s.consent) throw Error('Confirm recipient permission before scheduling.');
 if(!s.body?.trim() && !s.attachment_path && !s.template_name) throw Error('Add text, a file, or an approved template.');
 if(s.body?.length>4096) throw Error('Text must be 4096 characters or fewer.');
 if(!['once','daily','weekly','weekdays','interval'].includes(s.repeat)) throw Error('Invalid recurrence.');
 if(s.repeat==='weekdays' && !s.weekdays?.length) throw Error('Select at least one weekday.');
 if(s.repeat==='interval' && (!Number.isInteger(s.interval_minutes)||s.interval_minutes<15)) throw Error('Custom intervals must be at least 15 minutes.');
 if(s.repeat==='weekdays' && !s.weekdays.includes(DateTime.fromISO(s.local_time,{zone:s.timezone}).weekday)) throw Error('The first sending date must be one of the selected weekdays.');
 const first=occurrence(s.local_time,s.timezone);
 if(Date.parse(first)<=now) throw Error('Choose a future sending time.');
 if(s.end_date && s.end_date<s.local_time.slice(0,10)) throw Error('End date must follow the first send.');
 if(s.mode==='template' && !/^[a-z0-9_]+$/.test(s.template_name||'')) throw Error('Enter an approved template name.');
 return first;
}
