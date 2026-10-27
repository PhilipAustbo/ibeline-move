import { PUSH_API } from './push-config.js';
import { dateKey, addDays } from './planner.js';

const KEY='ibeline-reminders-v1', TOKEN='ibeline-reminders-device';
export function notificationSnapshot(state,today=dateKey()) {
  const from=addDays(today,-1),to=addDays(today,14);
  return Object.fromEntries(Object.entries(state.days).filter(([date])=>date>=from&&date<=to).map(([date,d])=>[date,{type:d.type,completed:d.completed}]));
}
export function createReminders({getState,onChange,notify}) {
  let settings={enabled:false,time:'18:00',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Oslo'};
  let ready=false, publicKey=null, busy=false, pending=false, error='', lastSynced='', timer, retryTimer, syncFlight=null, resync=false;
  try {const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&/^([01]\d|2[0-3]):[0-5]\d$/.test(saved.time))settings={...settings,time:saved.time,enabled:saved.enabled===true,pendingDelete:saved.pendingDelete===true};}catch{}
  const supported=()=>typeof Notification!=='undefined'&&'PushManager'in window&&'serviceWorker'in navigator;
  const needsHomeScreen=()=> (/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))&&!matchMedia('(display-mode: standalone)').matches&&!navigator.standalone;
  const persist=()=>localStorage.setItem(KEY,JSON.stringify(settings));
  const changed=()=>onChange();
  function token(create=false) {
    let value=localStorage.getItem(TOKEN);
    if(!/^[a-f0-9]{64}$/.test(value||'')&&create){value=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem(TOKEN,value);}
    return value;
  }
  async function api(path,method='GET',body) {
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(`${PUSH_API}${path}`,{method,headers:{'Content-Type':'application/json',...(token()?{Authorization:`Bearer ${token()}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Tjenesten svarte ikke.');return data;
    } finally {clearTimeout(timeout);}
  }
  async function syncNow() {
    if(!PUSH_API||!supported()||busy)return;
    if(settings.pendingDelete) {
      try{await api('/device','DELETE');settings.pendingDelete=false;persist();error='';}catch{error='Varslinger er av. Opprydding på serveren venter på nett.';}
      changed();return;
    }
    if(!settings.enabled||!ready)return;
    try {
      const registration=await navigator.serviceWorker.ready,sub=await registration.pushManager.getSubscription();
      if(!sub||Notification.permission!=='granted'){settings.enabled=false;persist();error='Varslingstillatelsen er fjernet. Aktiver igjen for å fortsette.';changed();return;}
      const payload={enabled:true,time:settings.time,timeZone:settings.timeZone,subscription:sub.toJSON(),days:notificationSnapshot(getState())};
      const serialized=JSON.stringify(payload);if(serialized===lastSynced){pending=false;return;}
      await api('/device','PUT',payload);lastSynced=serialized;pending=false;error='';changed();
    }catch{pending=true;error='Endringen venter på nett. En allerede planlagt påminnelse kan fortsatt komme før fullføringen er synkronisert.';changed();}
  }
  function sync() {
    if(syncFlight){resync=true;return syncFlight;}
    syncFlight=(async()=>{do{resync=false;await syncNow();}while(resync&&navigator.onLine);})().finally(()=>{syncFlight=null;});
    return syncFlight;
  }
  function syncSoon() {if(!settings.enabled&&!settings.pendingDelete)return;pending=true;clearTimeout(timer);timer=setTimeout(sync,700);}
  async function enable() {
    if(busy||!ready||!supported()||needsHomeScreen())return;
    // Ask directly in the click handler; iOS requires a user gesture.
    const permissionPromise=Notification.requestPermission();busy=true;error='';changed();
    let created=null;
    try {
      const permission=await permissionPromise;if(permission!=='granted')throw new Error('Varslinger ble ikke tillatt. Du kan endre dette i telefonens varslingsinnstillinger.');
      token(true);
      const registration=await navigator.serviceWorker.ready;
      let sub=await registration.pushManager.getSubscription();
      if(!sub){const raw=atob(publicKey.replace(/-/g,'+').replace(/_/g,'/'));sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});created=sub;}
      await api('/device','PUT',{enabled:true,time:settings.time,timeZone:settings.timeZone,subscription:sub.toJSON(),days:notificationSnapshot(getState())});
      settings.enabled=true;settings.pendingDelete=false;persist();pending=false;notify('Varslinger er aktivert. Prøv gjerne et testvarsel 💗');
    }catch(e){if(created)await created.unsubscribe().catch(()=>{});error=e.message||'Varslingene kunne ikke aktiveres.';}
    finally{busy=false;changed();}
  }
  async function disable() {
    busy=true;changed();
    let serverOff=false,phoneOff=false;
    try {
      if(syncFlight)await syncFlight;
      try{await api('/device','DELETE');serverOff=true;}catch{}
      try{const r=await navigator.serviceWorker.ready,sub=await r.pushManager.getSubscription();phoneOff=!sub||await sub.unsubscribe();}catch{}
      if(!serverOff&&!phoneOff)throw new Error('Kunne ikke slå av. Prøv igjen med nett, eller slå av varslinger i telefonens innstillinger.');
      settings.enabled=false;settings.pendingDelete=!serverOff;persist();pending=false;lastSynced='';error=serverOff?'':'Varslinger er av. Opprydding på serveren venter på nett.';notify('Varslinger er slått av.');
    }catch(e){error=e.message;}finally{busy=false;changed();}
  }
  async function start() {
    if(!PUSH_API||!supported())return;
    settings.timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Oslo';
    try{const config=await api('/config');ready=config.ready;publicKey=config.publicKey;if(!ready)error='Varslingstjenesten er ikke klar ennå.';}catch{error='Får ikke kontakt med varslingstjenesten. Prøv igjen når du er på nett.';}
    if(token()&&ready) {
      try{const remote=await api('/device');if(settings.enabled&&(!remote.registered||!remote.enabled)){settings.enabled=false;persist();error='Abonnementet er utløpt. Aktiver varslinger på nytt.';}}catch{}
    }
    changed();await sync();
    clearInterval(retryTimer);retryTimer=setInterval(()=>{if(document.visibilityState==='visible'&&(pending||settings.pendingDelete))sync();},30000);
  }
  document.addEventListener('click',async event=> {
    const button=event.target.closest('[data-reminder]');if(!button||button.disabled)return;
    const action=button.dataset.reminder;
    if(action==='enable')return enable();
    if(action==='disable')return disable();
    if(action==='save'){
      const time=document.querySelector('#reminder-time')?.value;
      if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||''))return notify('Velg et gyldig tidspunkt.');
      settings.time=time;try{persist();}catch{return notify('Nettleseren kunne ikke lagre tidspunktet.');}lastSynced='';pending=settings.enabled;await sync();changed();notify(pending?'Tidspunktet er lagret på telefonen og venter på nett.':'Tidspunktet er lagret.');
    }
    if(action==='test'){
      busy=true;changed();try{await api('/test','POST');notify('Testvarslet er sendt til telefonens varslingstjeneste.');}catch(e){notify(e.message);}finally{busy=false;changed();}
    }
    if(action==='retry')await start();
  });
  window.addEventListener('online',()=>start());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)start();});
  function panel() {
    const unavailable=!supported(),home=needsHomeScreen();
    const status=settings.enabled?(pending?'Endring venter på nett':'Varslinger er på'):'Varslinger er av';
    return `<section class="panel settings-panel reminder-panel"><p class="eyebrow">EN LITEN PÅMINNELSE</p><h2>Litt tid til deg 💗</h2><p>En vennlig påminnelse på treningsdagene dine. Hviledager hoppes over, og en valgfri søndagsøkt varsles bare hvis du har valgt løping.</p><span class="reminder-status ${settings.enabled?'enabled':''}" role="status">${status}</span>${home?'<p class="notice">På iPhone: Legg appen på hjemskjermen via Safari → Del → Legg til på Hjem-skjerm. Åpne deretter appikonet for å aktivere varslinger. Krever iOS 16.4 eller nyere.</p>':unavailable?'<p class="notice">Denne nettleseren støtter ikke pushvarslinger her. Bruk appen fra hjemskjermen på en oppdatert telefon.</p>':''}${!PUSH_API?'<p class="notice">Varslingstjenesten kobles til. Du kan velge tidspunkt allerede nå.</p>':''}<label class="reminder-time-label" for="reminder-time">Når passer en liten påminnelse?</label><div class="reminder-time-row"><input type="time" id="reminder-time" value="${settings.time}" ${busy?'disabled':''}/><button class="button secondary" data-reminder="save" ${busy?'disabled':''}>Lagre tidspunkt</button></div><p class="helper">Klokkeslettet følger tidssonen på denne telefonen (${settings.timeZone.replace(/[^A-Za-z_+\/-]/g,'')}). Vi oppdaterer tidssonen når appen åpnes. Levering kan påvirkes av nett og Fokus-innstillinger.</p>${error?`<p class="notice" role="alert">${error.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`:''}<button class="button ${settings.enabled?'secondary':'primary'}" data-reminder="${settings.enabled?'disable':'enable'}" ${busy||(!settings.enabled&&(!ready||unavailable||home))?'disabled':''}>${busy?'Et lite øyeblikk …':settings.enabled?'Slå av varslinger':'Aktiver varslinger'}</button>${settings.enabled?`<button class="text-button" data-reminder="test" ${busy?'disabled':''}>Send et testvarsel</button>`:PUSH_API&&!ready&&!unavailable&&!home?'<button class="text-button" data-reminder="retry">Prøv tilkoblingen igjen</button>':''}<p class="helper">Når du aktiverer, lagrer varslingstjenesten et teknisk pushabonnement, tidspunkt og øktvalg/fullføring fra i går og de neste 14 dagene. Øvelser og resten av historikken sendes ikke. Avslåing sletter varslingsdataene på serveren når nett er tilgjengelig. Fullføring må synkroniseres med nett for å stoppe en påminnelse.</p></section>`;
  }
  return {panel,syncSoon,start};
}
