import test from 'node:test';
import assert from 'node:assert/strict';
import {occurrence,nextOccurrence,validate} from '../src/schedule.js';
const s={phone:'+972501234567',consent:true,body:'Reminder',local_time:'2027-03-21T09:00',timezone:'Asia/Jerusalem',repeat:'weekly'};
test('one-time scheduling and international phone validation',()=>{assert.equal(validate(s,0),'2027-03-21T07:00:00.000Z');assert.equal(nextOccurrence({...s,repeat:'once'},validate(s,0)),null);assert.throws(()=>validate({...s,phone:'0501234567'},0));assert.throws(()=>validate({...s,consent:false},0));assert.throws(()=>validate(s,Date.parse('2028-01-01')))});
test('weekly recurrence preserves local clock across daylight saving',()=>{assert.equal(nextOccurrence(s,validate(s,0)),'2027-03-28T06:00:00.000Z')});
test('selected weekdays and inclusive end date',()=>{const t={...s,repeat:'weekdays',weekdays:[1,5],end_date:'2027-03-22'};assert.equal(nextOccurrence(t,validate(s,0)),'2027-03-22T07:00:00.000Z');assert.equal(nextOccurrence(t,'2027-03-22T07:00:00.000Z'),null)});
test('nonexistent DST time rejected and invalid zones rejected',()=>{assert.throws(()=>occurrence('2027-03-14T02:30','America/New_York'));assert.throws(()=>occurrence('2027-01-01T12:00','invalid/zone'))});
test('custom interval uses elapsed time',()=>{const t={...s,repeat:'interval',interval_minutes:90};assert.equal(nextOccurrence(t,'2027-03-21T07:00:00.000Z'),'2027-03-21T08:30:00.000Z');assert.throws(()=>validate({...t,interval_minutes:1},0))});
