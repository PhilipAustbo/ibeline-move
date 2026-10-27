import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH,randomBytes } from 'node:crypto';
import { localClock,localInstant,nextAlarm,reminderFor,validUpdate,validSubscription } from '../backend/core.js';
import worker,{ ReminderDevice } from '../backend/worker.js';
import { notificationSnapshot } from '../notifications.js';
import webpush from '../backend/node_modules/web-push/src/index.js';

const ecdh=createECDH('prime256v1');ecdh.generateKeys();
const subscription={endpoint:'https://web.push.apple.com/fake-unit-test-only',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
const record={enabled:true,time:'18:00',timeZone:'Europe/Oslo',subscription,days:{}};
test('påminnelsen bruker norsk lokal tid, også over sommertidsskifter',()=>{
  assert.equal(new Date(localInstant('2026-10-27','18:00','Europe/Oslo')).toISOString(),'2026-10-27T17:00:00.000Z');
  assert.equal(new Date(localInstant('2026-07-01','18:00','Europe/Oslo')).toISOString(),'2026-07-01T16:00:00.000Z');
  assert.equal(new Date(localInstant('2026-03-29','02:30','Europe/Oslo')).toISOString(),'2026-03-29T01:30:00.000Z');
  assert.equal(new Date(localInstant('2026-10-25','02:30','Europe/Oslo')).toISOString(),'2026-10-25T00:30:00.000Z');
});
test('neste alarm går til neste lokale dag etter at tidspunktet er passert',()=>{
  const next=nextAlarm(Date.parse('2026-10-24T17:00:01Z'),{time:'18:00',timeZone:'Europe/Oslo'});
  assert.equal(new Date(next).toISOString(),'2026-10-25T17:00:00.000Z');
  assert.deepEqual(localClock(next,'Europe/Oslo'),{date:'2026-10-25',time:'18:00'});
});
test('fullførte økter, hvile, duplikater og sene varsler hoppes over',()=>{
  const now=Date.parse('2026-10-27T17:00:00Z');
  assert.match(reminderFor(record,now).body,/gåtur/);
  assert.equal(reminderFor({...record,days:{'2026-10-27':{type:'walk',completed:true}}},now),null);
  assert.equal(reminderFor(record,Date.parse('2026-10-30T17:00:00Z')),null);
  assert.equal(reminderFor({...record,lastSent:'2026-10-27'},now),null);
  assert.equal(reminderFor({...record,enabled:false},now),null);
  assert.equal(reminderFor(record,now+3*3600000),null);
  assert.equal(reminderFor(record,now-60000),null);
});
test('søndagsvarsler krever et eksplisitt valg av løping',()=>{
  const now=Date.parse('2026-11-01T17:00:00Z');
  assert.equal(reminderFor(record,now),null);
  assert.match(reminderFor({...record,days:{'2026-11-01':{type:'run',completed:false}}},now).body,/løpetur/);
});
test('bare den lille datamengden varslingene trenger blir synkronisert',()=>{
  const s={days:{'2026-10-20':{type:'walk',completed:true},'2026-10-26':{type:'ballet',completed:true,exercises:['secret']},'2026-10-28':{type:'strength',completed:false,workoutId:'strength-a-v1',exercises:['squat']},'2026-11-20':{type:'rest',completed:false}}};
  assert.deepEqual(notificationSnapshot(s,'2026-10-27'),{'2026-10-26':{type:'ballet',completed:true},'2026-10-28':{type:'strength',completed:false}});
});
test('abonnementet må bruke en kjent HTTPS-pushtjeneste og gyldige nøkler',()=>{
  assert.equal(validSubscription(subscription),true);
  assert.equal(validSubscription({...subscription,endpoint:'https://evil.push.apple.com.example.net/'}),false);
  assert.equal(validSubscription({...subscription,endpoint:'http://web.push.apple.com/a'}),false);
  assert.equal(validSubscription({...subscription,endpoint:'https://127.0.0.1/a'}),false);
  assert.equal(validSubscription({...subscription,keys:{...subscription.keys,auth:'bad'}}),false);
});
test('serveren avviser ugyldige tider, tidssoner og øktdata',()=>{
  const now=Date.parse('2026-10-27T17:00:00Z');
  assert.equal(validUpdate(record,now),true);
  assert.equal(validUpdate({...record,time:'25:00'},now),false);
  assert.equal(validUpdate({...record,timeZone:'MadeUp/Place'},now),false);
  assert.equal(validUpdate({...record,days:{'2026-10-27':{type:'strength',completed:false}}},now),false);
  assert.equal(validUpdate({...record,days:{'2026-10-28':{type:'strength',completed:true}}},now),false);
  assert.equal(validUpdate({...record,days:{'2026-09-01':{type:'walk',completed:true}}},now),false);
});
class Storage {
  data=new Map();alarm=null;
  async get(k){return structuredClone(this.data.get(k));}
  async put(k,v){this.data.set(k,structuredClone(v));}
  async deleteAll(){this.data.clear();}
  async deleteAlarm(){this.alarm=null;}
  async setAlarm(value){this.alarm=value;}
}
test('en enhet kan aktiveres og deaktiveres, og avslåing sletter data og alarm',async()=>{
  const storage=new Storage(),device=new ReminderDevice({storage},{});
  const response=await device.fetch(new Request('https://test/device',{method:'PUT',body:JSON.stringify(record)}));
  assert.equal(response.status,200);assert.ok(storage.alarm>Date.now());
  await device.fetch(new Request('https://test/device',{method:'DELETE'}));
  assert.equal(storage.data.size,0);assert.equal(storage.alarm,null);
});
test('uforholdsmessig store forespørsler avvises før de lagres',async()=>{
  const storage=new Storage(),device=new ReminderDevice({storage},{});
  const response=await device.fetch(new Request('https://test/device',{method:'PUT',body:'x'.repeat(13000)}));
  assert.equal(response.status,413);assert.equal(storage.data.size,0);
});
test('API krever enhetsnøkkel og riktig origin, og lekker ingen private nøkler',async()=>{
  const env={ALLOWED_ORIGIN:'https://philipaustbo.github.io',VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private'};
  assert.equal((await worker.fetch(new Request('https://test/device',{headers:{Origin:env.ALLOWED_ORIGIN}}),env)).status,401);
  assert.equal((await worker.fetch(new Request('https://test/device',{headers:{Origin:'https://attacker.example',Authorization:`Bearer ${'a'.repeat(64)}`}}),env)).status,403);
  const config=await (await worker.fetch(new Request('https://test/config'),env)).json();
  assert.deepEqual(config,{ready:true,publicKey:'public'});assert.ok(!JSON.stringify(config).includes('private'));
});
test('pushlevering krypterer innholdet og bruker VAPID, uten å følge omdirigeringer',async t=>{
  const keys=webpush.generateVAPIDKeys();
  const device=new ReminderDevice({storage:new Storage()},{APP_URL:'https://philipaustbo.github.io/ibeline-move/',VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey});
  let sent;
  t.mock.method(globalThis,'fetch',async(url,init)=>{sent={url,init};return new Response('',{status:201});});
  await device.deliver(subscription,{title:'Privat test',body:'Hemmelig innhold'});
  assert.equal(sent.url,subscription.endpoint);assert.equal(sent.init.redirect,'error');
  assert.equal(sent.init.headers['Content-Encoding'],'aes128gcm');assert.match(sent.init.headers.Authorization,/^vapid /);
  assert.ok(!Buffer.from(sent.init.body).includes(Buffer.from('Hemmelig innhold')));
});
test('en alarm leverer bare én gang per dag og planlegger neste dag',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-27T17:00:00Z')});
  const storage=new Storage();await storage.put('device',record);
  const device=new ReminderDevice({storage},{});let deliveries=0;device.deliver=async()=>{deliveries++;};
  await device.alarm();await device.alarm();
  assert.equal(deliveries,1);assert.equal((await storage.get('device')).lastSent,'2026-10-27');
  assert.equal(new Date(storage.alarm).toISOString(),'2026-10-28T17:00:00.000Z');
});
test('synkronisert fullføring stopper alarmen og midlertidige feil kan prøves igjen',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-27T17:00:00Z')});
  const storage=new Storage();await storage.put('device',{...record,days:{'2026-10-27':{type:'walk',completed:true}}});
  const device=new ReminderDevice({storage},{});let deliveries=0;device.deliver=async()=>{deliveries++;throw new Error('offline');};
  await device.alarm();assert.equal(deliveries,0);
  await storage.put('device',record);await device.alarm();
  assert.equal(deliveries,1);assert.equal((await storage.get('device')).retries,1);
  assert.equal(storage.alarm,Date.now()+10*60000);
});
test('utløpt pushabonnement deaktiveres og forsøkes ikke på nytt',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-27T17:00:00Z')});
  const storage=new Storage();await storage.put('device',record);
  const device=new ReminderDevice({storage},{});let deliveries=0;device.deliver=async()=>{deliveries++;throw Object.assign(new Error('gone'),{status:410});};
  await device.alarm();await device.alarm();
  assert.equal(deliveries,1);assert.equal((await storage.get('device')).enabled,false);assert.equal((await storage.get('device')).subscription,null);
});
