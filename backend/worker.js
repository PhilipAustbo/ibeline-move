import webpush from 'web-push';
import { Buffer } from 'node:buffer';
import { localClock, nextAlarm, reminderFor, validUpdate } from './core.js';

const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export class ReminderDevice {
  constructor(ctx,env) {this.ctx=ctx;this.env=env;}
  async fetch(request) {
    const path=new URL(request.url).pathname;
    let record=await this.ctx.storage.get('device');
    if(request.method==='GET') return json({enabled:!!record?.enabled,registered:!!record?.subscription,time:record?.time,timeZone:record?.timeZone});
    if(request.method==='DELETE') {
      await this.ctx.storage.deleteAlarm();await this.ctx.storage.deleteAll();return json({ok:true});
    }
    if(request.method==='PUT'&&path==='/device') {
      const reader=request.body?.getReader();let text='',length=0;
      if(reader){const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>12000){await reader.cancel();return json({error:'For mye data.'},413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
      let input;try{input=JSON.parse(text);}catch{return json({error:'Ugyldig JSON.'},400);}
      if(!validUpdate(input))return json({error:'Ugyldige varslingsinnstillinger.'},400);
      record={enabled:input.enabled,time:input.time,timeZone:input.timeZone,subscription:input.subscription,days:input.days,lastSent:record?.lastSent??null,lastTest:record?.lastTest??0,updatedAt:Date.now(),retries:0};
      await this.ctx.storage.put('device',record);
      if(record.enabled)await this.ctx.storage.setAlarm(nextAlarm(Date.now(),record));else await this.ctx.storage.deleteAlarm();
      return json({ok:true,enabled:record.enabled});
    }
    if(request.method==='POST'&&path==='/test') {
      if(!record?.enabled||!record.subscription)return json({error:'Aktiver varslinger først.'},409);
      if(Date.now()-record.lastTest<60000)return json({error:'Vent ett minutt før neste test.'},429);
      record.lastTest=Date.now();await this.ctx.storage.put('device',record);
      try {
        await this.deliver(record.subscription,{title:'Hei, Ibeline 💗',body:'Varslingene virker! Her kommer dine små treningspåminnelser.',tag:'ibeline-test'});
        return json({ok:true});
      }catch(error){
        if([404,410].includes(error.status)){record.enabled=false;record.subscription=null;await this.ctx.storage.put('device',record);await this.ctx.storage.deleteAlarm();}
        return json({error:'Varslet kunne ikke sendes. Prøv å aktivere varslinger på nytt.'},502);
      }
    }
    return json({error:'Ikke funnet.'},404);
  }
  async deliver(subscription,payload) {
    const request=webpush.generateRequestDetails(subscription,JSON.stringify({...payload,url:this.env.APP_URL}),{
      TTL:1800,urgency:'normal',vapidDetails:{subject:this.env.APP_URL,publicKey:this.env.VAPID_PUBLIC_KEY,privateKey:this.env.VAPID_PRIVATE_KEY}
    });
    const response=await fetch(request.endpoint,{method:'POST',headers:request.headers,body:request.body,redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!response.ok){const error=new Error('Push delivery failed');error.status=response.status;throw error;}
  }
  async alarm() {
    let record=await this.ctx.storage.get('device');
    if(!record?.enabled||!record.subscription)return;
    const now=Date.now(),payload=reminderFor(record,now);
    if(payload) {
      if(record.retryDate!==payload.date){record.retryDate=payload.date;record.retries=0;await this.ctx.storage.put('device',record);}
      try {
        await this.deliver(record.subscription,payload);
        // Re-read to preserve a preference/completion update received during delivery.
        record=await this.ctx.storage.get('device');if(!record)return;
        record.lastSent=payload.date;record.retries=0;await this.ctx.storage.put('device',record);
      }catch(error){
        record=await this.ctx.storage.get('device');if(!record)return;
        if([404,410].includes(error.status)){record.enabled=false;record.subscription=null;await this.ctx.storage.put('device',record);return;}
        if((!error.status||error.status===429||error.status>=500)&&record.enabled&&(record.retries??0)<3){
          record.retries=(record.retries??0)+1;await this.ctx.storage.put('device',record);await this.ctx.storage.setAlarm(now+10*60000);return;
        }
      }
    }
    record=await this.ctx.storage.get('device');
    if(record?.enabled)await this.ctx.storage.setAlarm(nextAlarm(Date.now(),record));
  }
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url),origin=request.headers.get('Origin');
    const cors={'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Access-Control-Allow-Methods':'GET, PUT, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin','Cache-Control':'no-store'};
    if(origin&&origin!==env.ALLOWED_ORIGIN)return json({error:'Ukjent opphav.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    let response;
    if(request.method==='GET'&&url.pathname==='/config') {
      response=json({ready:!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY),publicKey:env.VAPID_PUBLIC_KEY??null});
    }else if(['/device','/test'].includes(url.pathname)){
      const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      if(!token||origin!==env.ALLOWED_ORIGIN)response=json({error:'Ingen tilgang.'},401);
      else if(!env.VAPID_PRIVATE_KEY)response=json({error:'Tjenesten er ikke ferdig satt opp.'},503);
      else {
        const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
        const name=Buffer.from(digest).toString('hex');
        const stub=env.DEVICES.get(env.DEVICES.idFromName(name));
        response=await stub.fetch(request);
      }
    }else response=json({error:'Ikke funnet.'},404);
    return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...cors}});
  }
};
