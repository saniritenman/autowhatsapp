import config from './config.json';
import {calendarApi} from './calendar-api.js';
let token='',expires=0;
export const clientId=()=>import.meta.env.VITE_GOOGLE_CLIENT_ID||config.googleClientId||'';
export const calendarReady=()=>!!token&&Date.now()<expires;
export function forgetCalendar(){token='';expires=0}
export function authorize(){
 if(calendarReady())return Promise.resolve();
 if(!clientId())return Promise.reject(Error('Google Calendar setup is not finished. The site owner must configure its Google OAuth client ID.'));
 if(!window.google?.accounts?.oauth2)return Promise.reject(Error('Google sign-in is still loading. Please try again.'));
 return new Promise((resolve,reject)=>{
 const client=window.google.accounts.oauth2.initTokenClient({client_id:clientId(),scope:'https://www.googleapis.com/auth/calendar.events.owned',callback:r=>{if(r.error){reject(Error(r.error_description||r.error));return}if(!window.google.accounts.oauth2.hasGrantedAllScopes(r,'https://www.googleapis.com/auth/calendar.events.owned')){reject(Error('Calendar permission was not granted.'));return}token=r.access_token;expires=Date.now()+(r.expires_in-60)*1000;resolve()},error_callback:()=>reject(Error('Google authorization was closed. Your draft was kept.'))});
 client.requestAccessToken({prompt:''});
 });
}
const transport=calendarApi(()=>calendarReady()?token:'',forgetCalendar);
export const syncReminder=(row,site)=>transport.sync(row,site);
export const cancelCalendar=row=>transport.cancel(row);
