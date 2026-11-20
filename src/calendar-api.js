import {eventFor,calendarId} from './model.js';

// No credentials are persisted here. The caller owns the short-lived OAuth token.
export function calendarApi(getToken,clearToken,request=fetch){
 async function api(path,method='GET',body){
  if(!getToken())throw Error('Reconnect Google Calendar, then retry.');
  const response=await request('https://www.googleapis.com/calendar/v3/calendars/primary/events/'+encodeURIComponent(path),{method,headers:{Authorization:'Bearer '+getToken(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(response.status===401){clearToken();throw Error('Reconnect Google Calendar, then retry.');}
  if(method==='DELETE'&&[204,404,410].includes(response.status))return {status:response.status,data:null};
  if(!response.ok&&response.status!==409)throw Error('Google Calendar did not save this reminder ('+response.status+'). Your draft is saved; retry Calendar sync.');
  return {status:response.status,data:await response.json()};
 }
 return {
  async sync(row,site){
   const event=eventFor(row,site);const {id,...fields}=event;const patch={...fields,recurrence:event.recurrence||[]};let result;
   if(row.calendar_event_id)result=await api(row.calendar_event_id,'PATCH',patch);
   else{
    result=await api('','POST',event);
    if(result.status===409){
     const existing=await api(calendarId(row.id));
     if(existing.data.extendedProperties?.private?.autowhatsapp_id!==row.id)throw Error('Calendar event identity conflict.');
     result=await api(calendarId(row.id),'PATCH',patch);
    }
   }
   return result.data;
  },
  async cancel(row){await api(row.calendar_event_id||calendarId(row.id),'DELETE')}
 };
}
