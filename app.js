import { TYPES, EXERCISES, REWARDS, dateKey, parseDate, addDays, monday, options, recommend, planned, required, stats, validState } from './planner.js';

const STORAGE = 'ibeline-move-v1';
let state = { version: 1, startDate: dateKey(), days: {}, claimed: [] };
let storageWarning = false;
try {
  const saved = localStorage.getItem(STORAGE);
  if (saved) { const data = JSON.parse(saved); if (validState(data)) state = data; else storageWarning = true; }
  else localStorage.setItem(STORAGE, JSON.stringify(state));
} catch { storageWarning = true; }
let page = 'home';
let week = monday(dateKey());
let month = new Date(parseDate(dateKey()).getFullYear(), parseDate(dateKey()).getMonth(), 1, 12);
let activeDate = null;
let renderedDate = dateKey();
let returnFocus = null;
const app = document.querySelector('#app');
const dialog = document.querySelector('#workout-dialog');
const paths = {
  flower: '<path d="M12 9C5-3 0 10 9 12c-12 7 1 12 3 3 7 12 12-1 3-3 12-7-1-12-3-3Z"/><circle cx="12" cy="12" r="2"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13m0-13C3 8 6 0 10 4l2 4Zm0 0c9 0 6-8 2-4l-2 4Z"/>',
  settings: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  heart: '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 3 11 8 15 5-4 13-10 8-15Z"/>',
  leaf: '<path d="M20 3C9 1 2 7 5 15c8 6 16-2 15-12ZM3 21 15 9M9 15v-4m0 4h5"/>',
  strength: '<path d="m5 5 14 14M3 7l4-4m10 18 4-4M1 5l4-4m14 22 4-4M7 10l3-3m4 10 3-3"/>',
  ballet: '<path d="m9 2 1 10-5 5a3 3 0 0 0 4 4l5-5-1-14m-3 10 4 4m-7 2 3 3M16 2l2 9 3 7a2 2 0 0 1-4 2l-3-6m3-5 3-1"/>',
  run: '<circle cx="15" cy="4" r="2"/><path d="m7 10 5-3 4 5 4 1M12 7l-2 7 5 3-1 5m-4-8-4 5H2"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  fire: '<path d="M12 2c1 6 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 3-7 0 4 2 4 2 4s4-5 2-10Z"/><path d="M12 14c-4 5 3 7 3 3"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  sparkles: '<path d="m12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2Zm7 0v4m-2-2h4"/>',
  coffee: '<path d="M4 8h12v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Zm12 1h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>'
};
function icon(name, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.heart}</svg>`; }
function format(key, opts) { return parseDate(key).toLocaleDateString('nb-NO', opts); }
function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); storageWarning = false; }
  catch { storageWarning = true; toast('Nettleseren kunne ikke lagre. Ta en sikkerhetskopi under Min side.'); }
}
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('visible'), 4500); }
function editable(key) { return key >= state.startDate && key <= dateKey(); }
function dayEntry(key) {
  if (!state.days[key]) state.days[key] = { type: planned(key, state).type, completed: false, exercises: [] };
  return state.days[key];
}
function nav() {
  return [['home', 'home', 'Oversikt'], ['calendar', 'calendar', 'Kalender'], ['rewards', 'gift', 'Mine belønninger'], ['settings', 'heart', 'Min side']].map(([id, img, label]) => `<button class="nav-item ${page === id ? 'active' : ''}" data-page="${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(img)}<span>${label}</span>${page === id ? '<i></i>' : ''}</button>`).join('');
}
function render() {
  renderedDate = dateKey();
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="#" data-page="home">${icon('flower')}<span>ibeline<span class="brand-dot">.</span></span></a><p class="brand-sub">BEVEGELSE & BALANSE</p><nav aria-label="Hovedmeny">${nav()}</nav><div class="sidebar-note">${icon('heart')}<p>For deg.<br>På din måte.</p><span>En liten økt kan gjøre en stor forskjell.</span></div><div class="made-with">Laget med kjærlighet ${icon('heart')}</div></aside><div class="workspace"><header class="topbar"><span class="breadcrumb">Ditt lille pusterom <span>/ ${ { home: 'Oversikt', calendar: 'Kalender', rewards: 'Belønninger', settings: 'Min side' }[page]}</span></span><div class="profile"><span>Hei, Ibeline</span><span class="avatar">I${icon('flower')}</span></div></header><main id="main">${storageWarning ? '<div class="notice" role="alert">Fremgangen kan ikke leses eller lagres i nettleseren. Eksporter en sikkerhetskopi på Min side før du lukker appen.</div>' : ''}${page === 'home' ? home() : page === 'calendar' ? calendar() : page === 'rewards' ? rewards() : settings()}</main><footer>Små steg. Din rytme. Masse å være stolt av. ${icon('flower')}</footer></div><nav class="mobile-nav" aria-label="Mobilmeny">${nav()}</nav>`;
}
function heading(kicker, title, subtitle, extra = '') { return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${extra}</div>`; }
function home() {
  const today = dateKey(), tally = stats(state), selected = planned(today, state).type, type = TYPES[selected], done = state.days[today]?.completed;
  const nextReward = REWARDS.find(r => r.target > tally.total);
  return `${heading(format(today, { weekday: 'long', day: 'numeric', month: 'long' }), 'Litt bevegelse. Masse godfølelse.', 'Dette er din tid, Ibeline. La oss gjøre noe fint med den.', '<span class="small-note">én dag om gangen '+icon('sparkles')+'</span>')}
  <section class="hero"><div class="hero-copy"><span class="pill">${icon(done ? 'check' : 'sparkles')}${done ? 'DAGENS LILLE SEIER' : 'DIN PLAN FOR I DAG'}</span><h2>${done ? 'Du gjorde det, Ibeline.' : type.name}</h2><p>${done ? 'En avtale med deg selv, holdt. Ta med deg den gode følelsen videre.' : type.caption}</p><div class="hero-meta"><span>${icon(type.icon)}${selected === 'rest' ? 'Plass til å hente seg inn' : type.duration}</span><span>♡ &nbsp; Bare for deg</span></div><button class="button primary" data-open="${today}">${done ? 'Se gjennomført økt' : selected === 'rest' ? 'Se dagens plan' : 'Se dagens økt'}${icon('arrow')}</button></div><div class="hero-art" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><div class="flower-art"><i></i><i></i><i></i><i></i><i></i><i></i><b></b></div><span class="art-spark one">✧</span><span class="art-spark two">✦</span><span class="art-note">bloom at your own pace</span></div></section>
  <section class="stats-grid" aria-label="Din fremgang"><article class="stat-card"><div class="stat-icon peach">${icon('fire')}</div><div><span class="stat-label">Din streak</span><p><strong>${tally.streak}</strong> <span>planlagte økter på rad</span></p></div></article><article class="stat-card"><div class="stat-icon sage">${icon('check')}</div><div><span class="stat-label">Denne uken</span><p><strong>${tally.plannedWeek}<small> / 5</small></strong> <span>planlagte økter fullført</span></p></div></article><article class="stat-card"><div class="stat-icon lilac">${icon('star')}</div><div><span class="stat-label">Alle dine små seire</span><p><strong>${tally.total}</strong> <span>økter gjennomført</span></p></div></article></section>
  <div class="dashboard-columns"><section class="panel weekly"><div class="section-top"><div><p class="eyebrow">LITT AV ALT SOM GJØR DEG GODT</p><h2>Din uke, din rytme</h2></div><div class="week-controls"><button class="icon-button" data-week="-7" aria-label="Forrige uke">${icon('chevron', 'flip')}</button><span>${format(week, { day: 'numeric', month: 'short' })} – ${format(addDays(week, 6), { day: 'numeric', month: 'short' })}</span><button class="icon-button" data-week="7" aria-label="Neste uke">${icon('chevron')}</button></div></div><div class="week-list">${Array.from({ length: 7 }, (_, i) => weekRow(addDays(week, i))).join('')}</div><button class="text-button calendar-link" data-page="calendar">Se hele kalenderen ${icon('arrow')}</button></section><div class="side-panels"><section class="panel next-reward"><span class="round-gift">${icon(nextReward?.icon || 'gift')}</span><p class="eyebrow">NOE Å GLEDE SEG TIL</p><h2>${nextReward ? nextReward.name : 'Du har nådd alle milepælene!'}</h2><p>${nextReward ? nextReward.gift : 'Fortsett å samle små seire, i ditt eget tempo.'}</p>${nextReward ? `<div class="progress"><span style="width:${Math.min(100, tally.total / nextReward.target * 100)}%"></span></div><div class="progress-caption"><b>${tally.total} av ${nextReward.target} økter</b><span>${nextReward.target - tally.total} igjen ♡</span></div>` : ''}<button class="text-button" data-page="rewards">Alle belønninger ${icon('arrow')}</button></section><section class="kind-note"><span>en liten påminnelse</span><p>Du trenger ikke gjøre alt.<br>Bare noe som gjør deg godt.</p>${icon('flower')}</section></div></div>`;
}
function weekRow(key) {
  const type = TYPES[planned(key, state).type], day = state.days[key], today = key === dateKey();
  return `<button class="week-row ${today ? 'is-today' : ''} ${day?.completed ? 'is-done' : ''}" data-open="${key}"><div class="day-label"><span>${format(key, { weekday: 'short' }).replace('.', '')}</span><strong>${parseDate(key).getDate()}</strong></div><span class="activity-icon ${type.color}">${icon(type.icon)}</span><div class="week-activity"><strong>${type.name}${today ? '<span class="today-tag">I dag</span>' : ''}</strong><span>${day?.completed ? 'Gjennomført. Så fint gjort!': type.duration + (parseDate(key).getDay() === 0 ? ' · Valgfritt' : options(key).length > 1 ? ' · Du kan velge' : '')}</span></div>${day?.completed ? `<span class="done-check">${icon('check')}</span>` : icon('chevron', 'row-arrow')}</button>`;
}
function calendar() {
  const first = dateKey(month), offset = (month.getDay() + 6) % 7, days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: offset }, () => '<div class="calendar-empty" aria-hidden="true"></div>');
  for (let i = 1; i <= days; i++) {
    const key = dateKey(new Date(month.getFullYear(), month.getMonth(), i, 12)), type = TYPES[planned(key, state).type], done = state.days[key]?.completed;
    cells.push(`<button class="calendar-day ${key === dateKey() ? 'is-today' : ''} ${done ? 'is-done' : ''}" data-open="${key}" aria-label="${format(key, { day: 'numeric', month: 'long' })}, ${type.name}${done ? ', gjennomført' : ''}"><span class="calendar-number">${i}${done ? icon('check') : ''}</span><span class="calendar-activity ${type.color}">${icon(type.icon)}<span>${type.name}</span></span>${parseDate(key).getDay() === 0 ? '<small>Valgfritt</small>' : options(key).length > 1 ? '<small>To valg</small>' : ''}</button>`);
  }
  return `${heading('PLASS TIL BÅDE BEVEGELSE OG HVILE', 'Din lille treningskalender', 'En plan å glede seg til. Og rom for å velge underveis.')}<section class="panel calendar-panel"><div class="section-top"><h2>${month.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })}</h2><div class="week-controls"><button class="text-button" data-calendar-today>I dag</button><button class="icon-button" data-month="-1" aria-label="Forrige måned">${icon('chevron', 'flip')}</button><button class="icon-button" data-month="1" aria-label="Neste måned">${icon('chevron')}</button></div></div><div class="calendar-grid"><div class="weekday">Man</div><div class="weekday">Tir</div><div class="weekday">Ons</div><div class="weekday">Tor</div><div class="weekday">Fre</div><div class="weekday">Lør</div><div class="weekday">Søn</div>${cells.join('')}</div></section><div class="calendar-legend">${['ballet','walk','strength','run','rest'].map(t=>`<span><i class="${TYPES[t].color}"></i>${t === 'walk' ? 'Gåtur' : t === 'strength' ? 'Styrke' : t === 'rest' ? 'Hvile' : TYPES[t].name}</span>`).join('')}</div><p class="helper">Trykk på en dag for å se økten eller velge mellom alternativene. Fremtidige økter kan planlegges, og registreres når dagen kommer.</p>`;
}
function rewards() {
  const tally = stats(state);
  return `${heading('FEIR DE SMÅ SEIRENE', 'Du fortjener noe fint.', 'Hver gjennomførte økt teller. Også den lille søndagsturen.')}<section class="reward-summary"><span class="stat-icon pink">${icon('gift')}</span><div><h2>${tally.total} økter. ${tally.total} grunner til å være stolt.</h2><p>Små forslag til hyggelige belønninger du kan gi deg selv.</p></div></section><div class="rewards-grid">${REWARDS.map(r => { const unlocked = tally.total >= r.target, claimed = state.claimed.includes(r.target); return `<article class="panel reward-card ${unlocked ? 'unlocked' : ''}"><div class="reward-card-top"><span class="reward-symbol ${unlocked ? 'pink' : 'sand'}">${icon(r.icon)}</span><span class="reward-status">${claimed ? 'Feiret ♡' : unlocked ? 'Låst opp!' : icon('lock') + r.target + ' økter'}</span></div><p class="eyebrow">${r.target} SMÅ SEIRE</p><h2>${r.name}</h2><p>${r.gift}</p><div class="progress"><span style="width:${Math.min(100,tally.total/r.target*100)}%"></span></div><div class="progress-caption"><span>${Math.min(tally.total,r.target)} / ${r.target} økter</span></div><button class="button ${unlocked ? 'primary' : 'secondary'}" data-claim="${r.target}" ${!unlocked || claimed ? 'disabled' : ''}>${claimed ? 'Denne er feiret' : unlocked ? 'Jeg har feiret denne' : `${r.target-tally.total} økter til`}${icon(claimed ? 'check' : 'heart')}</button></article>`; }).join('')}</div><section class="panel explanation"><h2>Streak, uten dårlig samvittighet</h2><p>Streaken teller planlagte økter på rad: mandag, tirsdag, onsdag, torsdag og lørdag. Fredagens hvile og den valgfrie søndagen bryter aldri streaken. En fullført søndagsøkt gir en ekstra seier mot belønningene. En planlagt økt som ikke er gjennomført ved dagens slutt, starter streaken på nytt.</p></section>`;
}
function settings() {
  return `${heading('DITT EGET LILLE HJØRNE', 'Helt din, Ibeline.', 'En enkel plan. Gode vaner. Og litt plass til deg selv.')}<div class="settings-grid"><section class="panel settings-panel"><p class="eyebrow">DIN FASTE RYTME</p><h2>En uke med balanse</h2><dl class="schedule">${[['Mandag','Ballett'],['Tirsdag','Gåtur'],['Onsdag','Styrke'],['Torsdag','Ballett eller styrke'],['Fredag','Hvile'],['Lørdag','Løping eller styrke'],['Søndag','Løping eller fri · valgfritt']].map(([d,t])=>`<div><dt>${d}</dt><dd>${t}</dd></div>`).join('')}</dl><p class="helper">Torsdag foreslås ballett først. Anbefalingene bruker gjennomførte økter fra dagen før. Har du løpt, foreslås styrke der planen tillater det, ellers hvile på søndag.</p></section><div class="side-panels"><section class="panel settings-panel"><p class="eyebrow">TA MED DEG DE SMÅ SEIRENE</p><h2>Din fremgang</h2><p>Fremgangen lagres i denne nettleseren på denne enheten. Ta en sikkerhetskopi før du bytter telefon eller sletter nettleserdata. Det er ingen automatisk synkronisering.</p><button class="button secondary" data-export>${icon('download')} Last ned sikkerhetskopi</button><label class="button secondary import-label">${icon('upload')} Gjenopprett fra fil<input type="file" id="import-file" accept="application/json,.json" /></label><p class="helper">Du kan forhåndsvise en sikkerhetskopi før den erstatter fremgangen her.</p></section><section class="panel settings-panel"><p class="eyebrow">ALLTID LITT NÆRMERE</p><h2>Appen på hjemskjermen</h2><p>På iPhone: Åpne appens lenke i Safari, trykk Del og velg «Legg til på Hjem-skjerm».</p><p>På Android: Åpne lenken i Chrome og velg «Installer app» eller «Legg til på startskjermen» i menyen.</p><p class="helper">Etter første besøk kan appen også brukes uten nett. Startet ${format(state.startDate,{day:'numeric',month:'long',year:'numeric'})}.</p></section></div></div>`;
}
function workout(key, reopen = true) {
  activeDate = key;
  const rec = recommend(key, state), selected = planned(key, state).type, type = TYPES[selected], entry = state.days[key], done = !!entry?.completed;
  const checked = entry?.exercises || [], canEdit = editable(key), canPlan = key >= state.startDate;
  dialog.innerHTML = `<div class="dialog-header"><span class="eyebrow">${format(key,{weekday:'long', day:'numeric', month:'long'})}</span><button class="icon-button" data-close aria-label="Lukk økten">${icon('close')}</button></div><span class="dialog-activity-icon ${type.color}">${icon(type.icon)}</span><h2 id="dialog-title">${type.name}</h2><p class="dialog-caption">${type.caption}</p>${options(key).length > 1 ? `<div class="choice-label">Hva har du lyst til?</div><div class="choices" role="group" aria-label="Velg økt">${options(key).map(t=>`<button class="choice ${selected===t?'selected':''}" data-choice="${t}" ${done || !canPlan ? 'disabled':''}>${icon(TYPES[t].icon)}<span>${TYPES[t].name}${rec.type===t ? '<small>Anbefalt</small>':''}</span>${selected===t?icon('check'):''}</button>`).join('')}</div><p class="recommendation">${icon('sparkles')}${rec.reason}</p>`:''}<p class="workout-detail">${type.detail}</p>${selected==='strength' ? `<div class="exercise-heading"><h3>Din økt</h3><span>${checked.length} av ${EXERCISES.length} øvelser</span></div><div class="progress"><span style="width:${checked.length/EXERCISES.length*100}%"></span></div><div class="exercise-list">${EXERCISES.map((e,i)=>`<label class="exercise ${checked.includes(e.id)?'checked':''}"><input type="checkbox" data-exercise="${e.id}" ${checked.includes(e.id)?'checked':''} ${!canEdit?'disabled':''} /><span class="custom-check">${icon('check')}</span><span class="exercise-info"><strong>${e.name}</strong><span>${e.note}</span></span><span class="sets">${e.sets}</span></label>`).join('')}</div>`:''}${!canEdit ? `<p class="notice">${key>dateKey()?'Du kan planlegge nå og krysse av når dagen kommer.':'Denne dagen er før du begynte å bruke appen.'}</p>` : ''}${selected !== 'rest' ? `<button class="button primary finish-workout" data-complete ${!canEdit || (!done && selected==='strength' && checked.length!==EXERCISES.length)?'disabled':''}>${icon(done?'check':'heart')}${done?'Gjennomført! Angre registrering':'Jeg er ferdig med økten'}${!done?icon('arrow'):''}</button>${selected==='strength'&&!done&&canEdit?'<p class="helper center">Kryss av øvelsene underveis. De strykes ut når de er gjort.</p>':''}`:'<div class="rest-note">'+icon('moon')+'Ingen økt å krysse av i dag. Nyt pausen ♡</div>'}`;
  if (reopen && !dialog.open) { returnFocus = document.activeElement; dialog.showModal(); }
}
function closeDialog() { dialog.close(); activeDate = null; returnFocus?.focus(); }
document.addEventListener('click', event => {
  const target = event.target.closest('button, a');
  if (!target || target.disabled) return;
  if (target.dataset.page) { event.preventDefault(); page=target.dataset.page; render(); window.scrollTo({top:0,behavior:'instant'}); }
  if (target.dataset.open) workout(target.dataset.open);
  if (target.hasAttribute('data-close')) closeDialog();
  if (target.dataset.week) { week=addDays(week, Number(target.dataset.week)); render(); }
  if (target.dataset.month) { month.setMonth(month.getMonth()+Number(target.dataset.month)); render(); }
  if (target.hasAttribute('data-calendar-today')) { month=new Date(parseDate(dateKey()).getFullYear(),parseDate(dateKey()).getMonth(),1,12); render(); }
  if (target.dataset.choice && activeDate && activeDate >= state.startDate && !state.days[activeDate]?.completed) {
    const entry=dayEntry(activeDate); if (options(activeDate).includes(target.dataset.choice)) { entry.type=target.dataset.choice; entry.exercises=[]; save(); render(); workout(activeDate,false); }
  }
  if (target.hasAttribute('data-complete') && activeDate && editable(activeDate)) {
    const entry=dayEntry(activeDate);
    if (entry.type==='rest' || (!entry.completed && entry.type==='strength' && entry.exercises.length!==EXERCISES.length)) return;
    entry.completed=!entry.completed; save(); render(); workout(activeDate,false);
    toast(entry.completed?'En liten seier til deg. Så fint gjort, Ibeline! ♡':'Registreringen er angret.');
    if (entry.completed && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const confetti=document.createElement('div'); confetti.className='confetti'; confetti.setAttribute('aria-hidden','true');
      confetti.innerHTML=Array.from({length:24},(_,i)=>`<i style="--x:${Math.random()*100}%;--r:${Math.random()*500}deg;--d:${Math.random()*.4}s;--c:${['#d96c96','#ecd28e','#94ad9b','#c1a5d5'][i%4]}"></i>`).join(''); document.body.append(confetti); setTimeout(()=>confetti.remove(),2000);
    }
  }
  if (target.dataset.claim) { const value=Number(target.dataset.claim); if (stats(state).total>=value && REWARDS.some(r=>r.target===value) && !state.claimed.includes(value)) { state.claimed.push(value); save(); render(); toast('Den lille seieren er feiret. Kos deg! ♡'); } }
  if (target.hasAttribute('data-export')) {
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob), link=document.createElement('a'); link.href=url; link.download=`ibeline-${dateKey()}.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});
document.addEventListener('change', async event => {
  if (event.target.dataset.exercise && activeDate && editable(activeDate)) {
    const entry=dayEntry(activeDate), id=event.target.dataset.exercise;
    if (entry.type!=='strength' || !EXERCISES.some(e=>e.id===id)) return;
    if (event.target.checked) entry.exercises=[...new Set([...entry.exercises,id])]; else { entry.exercises=entry.exercises.filter(e=>e!==id); entry.completed=false; }
    save(); render(); workout(activeDate,false); dialog.querySelector(`[data-exercise="${id}"]`)?.focus();
  }
  if (event.target.id==='import-file' && event.target.files[0]) {
    const file=event.target.files[0];
    try {
      if (file.size>2_000_000) throw new Error('large');
      const backup=JSON.parse(await file.text()); if (!validState(backup)) throw new Error('invalid');
      const total=stats(backup).total;
      if (window.confirm(`Sikkerhetskopien inneholder ${total} gjennomførte økter og starter ${format(backup.startDate,{day:'numeric',month:'long',year:'numeric'})}. Den erstatter fremgangen som er lagret her (${stats(state).total} økter). Vil du gjenopprette?`)) { state=backup; save(); render(); toast('Sikkerhetskopien er gjenopprettet. Velkommen tilbake ♡'); }
    } catch { toast('Denne filen er ikke en gyldig Ibeline-sikkerhetskopi.'); }
    event.target.value='';
  }
});
dialog.addEventListener('click', event=> { if (event.target===dialog) { const r=dialog.getBoundingClientRect(); if (event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) closeDialog(); } });
dialog.addEventListener('cancel',()=>{activeDate=null;});
document.addEventListener('visibilitychange',()=> { if (!document.hidden && renderedDate!==dateKey()) { render(); if(activeDate)workout(activeDate,false); } });
setInterval(()=>{ if(renderedDate!==dateKey()){render();if(activeDate)workout(activeDate,false);} },30000);
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
