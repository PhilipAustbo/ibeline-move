import { options, recommend } from '../planner.js';
import { Buffer } from 'node:buffer';

const formatterCache = new Map();
export function localClock(timestamp, timeZone) {
  if (!formatterCache.has(timeZone)) formatterCache.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }));
  const parts=Object.fromEntries(formatterCache.get(timeZone).formatToParts(new Date(timestamp)).map(p=>[p.type,p.value]));
  return { date:`${parts.year}-${parts.month}-${parts.day}`, time:`${parts.hour}:${parts.minute}` };
}
export function localInstant(date, time, timeZone) {
  const target=Date.parse(`${date}T${time}:00Z`);
  let guess=target;
  const candidates=[];
  for(let i=0;i<4;i++) {
    candidates.push(guess);
    const clock=localClock(guess,timeZone);
    const delta=target-Date.parse(`${clock.date}T${clock.time}:00Z`);
    if (!delta) break;
    guess+=delta;
  }
  // The first occurrence on the autumn DST change; move forward across a spring gap.
  const nearby=[...candidates,...[-2,-1,-0.5,0.5,1,2].map(h=>guess+h*3600000)];
  const exact=nearby.filter(ms=>{const c=localClock(ms,timeZone);return c.date===date&&c.time===time;});
  return exact.length ? Math.min(...exact) : Math.max(...candidates.slice(-2));
}
export function nextAlarm(now, preferences) {
  const date=localClock(now,preferences.timeZone).date;
  const today=localInstant(date,preferences.time,preferences.timeZone);
  if(today>now) return today;
  const tomorrow=new Date(`${date}T12:00:00Z`);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  return localInstant(tomorrow.toISOString().slice(0,10),preferences.time,preferences.timeZone);
}
export function reminderFor(record, now) {
  if(!record?.enabled||!record.subscription) return null;
  const local=localClock(now,record.timeZone), due=localInstant(local.date,record.time,record.timeZone);
  if(now<due || now-due>2*3600000 || record.lastSent===local.date) return null;
  const day=record.days[local.date];
  const type=day?.type ?? recommend(local.date,{days:record.days}).type;
  if(type==='rest'||day?.completed) return null;
  const text={ballet:'ballettimen',walk:'en deilig gåtur',strength:'dagens styrkeøkt',run:'en liten løpetur'}[type];
  return {date:local.date,title:'Litt tid til deg, Ibeline 💗',body:`Klar for ${text}? Ta det i ditt eget tempo.`,tag:`ibeline-${local.date}`};
}
export function validSubscription(subscription) {
  try {
    const u=new URL(subscription.endpoint);
    const allowed=u.hostname.endsWith('.push.apple.com')||u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.notify.windows.com');
    if(u.protocol!=='https:'||u.username||u.password||u.port||!allowed||subscription.endpoint.length>2048) return false;
    const {p256dh,auth}=subscription.keys;
    return /^[A-Za-z0-9_-]{87}$/.test(p256dh)&&/^[A-Za-z0-9_-]{22}$/.test(auth)&&Buffer.from(p256dh,'base64url').length===65&&Buffer.from(p256dh,'base64url')[0]===4&&Buffer.from(auth,'base64url').length===16;
  } catch {return false;}
}
export function validUpdate(data,now=Date.now()) {
  if(!data||typeof data.enabled!=='boolean'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)||typeof data.timeZone!=='string'||data.timeZone.length>80) return false;
  try {localClock(now,data.timeZone);}catch{return false;}
  if(!validSubscription(data.subscription)||!data.days||typeof data.days!=='object'||Array.isArray(data.days)||Object.keys(data.days).length>16) return false;
  const today=Date.parse(`${localClock(now,data.timeZone).date}T12:00:00Z`);
  return Object.entries(data.days).every(([key,d])=>{
    const timestamp=Date.parse(`${key}T12:00:00Z`);
    return /^\d{4}-\d{2}-\d{2}$/.test(key)&&Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===key&&timestamp>=today-86400000&&timestamp<=today+14*86400000&&d&&options(key).includes(d.type)&&typeof d.completed==='boolean'&&(!d.completed||timestamp<=today);
  });
}
