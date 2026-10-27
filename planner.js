export const TYPES = {
  ballet: { name: 'Ballett', caption: 'Finn flyten, én plié om gangen.', duration: '60 min', icon: 'ballet', color: 'pink', detail: 'Din faste ballettime. Nyt musikken, bevegelsen og en liten stund helt for deg selv.' },
  walk: { name: 'En deilig gåtur', caption: 'Frisk luft. Litt lavere skuldre.', duration: '30–45 min', icon: 'leaf', color: 'sage', detail: 'Velg en rute du liker, ta på gode sko og gå i ditt eget tempo. En podkast eller bare lydene rundt deg?' },
  strength: { name: 'Sterk & stødig', caption: 'Litt sterkere, på din måte.', duration: '35–45 min', icon: 'strength', color: 'lilac', detail: 'En enkel helkroppsøkt. Start med 5 minutter rolig oppvarming. Tilpass belastning og repetisjoner til dagsformen, og ta pauser når du trenger det.' },
  run: { name: 'En liten løpetur', caption: 'Ditt tempo. Din lille seier.', duration: '20–30 min', icon: 'run', color: 'peach', detail: 'Start rolig og finn et behagelig tempo. Det er helt fint å veksle mellom å gå og løpe. Avslutt med noen rolige minutter.' },
  rest: { name: 'Tid til å lande', caption: 'Hvile er også en del av planen.', duration: 'Ingen hast', icon: 'moon', color: 'sand', detail: 'En dag med god samvittighet og lave skuldre. Gjør noe som gir deg overskudd.' }
};
export const EXERCISES = [
  { id: 'squat', name: 'Knebøy', sets: '3 × 10', note: 'Med kroppsvekt eller en vekt du er komfortabel med.' },
  { id: 'bridge', name: 'Seteløft', sets: '3 × 12', note: 'Rolig opp, en liten pause på toppen, rolig ned.' },
  { id: 'row', name: 'Roing', sets: '3 × 10', note: 'Med strikk eller manualer. Trekk albuene bakover.' },
  { id: 'push', name: 'Armhevinger', sets: '3 × 8', note: 'Mot en benk eller på knærne om du vil.' },
  { id: 'lunge', name: 'Bakoverutfall', sets: '2 × 8 per side', note: 'Finn balansen og ta det i ditt eget tempo.' },
  { id: 'plank', name: 'Planke', sets: '3 × 20 sek', note: 'Pust rolig. Kortere intervaller er også fint.' }
];
export const REWARDS = [
  { target: 1, name: 'Den første lille seieren', gift: 'En velfortjent kaffepause', icon: 'coffee' },
  { target: 5, name: 'Godt i gang', gift: 'Velg filmen til neste filmkveld', icon: 'star' },
  { target: 10, name: 'Din egen rytme', gift: 'Tid for en liten egenpleiekveld', icon: 'heart' },
  { target: 20, name: 'Se hva du får til!', gift: 'Planlegg en hyggelig date', icon: 'gift' },
  { target: 40, name: 'En vane å være glad i', gift: 'Velg en opplevelse å glede deg til', icon: 'sparkles' }
];
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(key) { return new Date(`${key}T12:00:00`); }
export function addDays(key, amount) { const d = parseDate(key); d.setDate(d.getDate() + amount); return dateKey(d); }
export function monday(key) { const day = parseDate(key).getDay(); return addDays(key, -(day === 0 ? 6 : day - 1)); }
export function options(key) {
  return [['run', 'rest'], ['ballet'], ['walk'], ['strength'], ['ballet', 'strength'], ['rest'], ['run', 'strength']][parseDate(key).getDay()];
}
export function recommend(key, state) {
  const choices = options(key);
  const yesterday = state.days[addDays(key, -1)];
  const previousType = yesterday?.completed ? yesterday.type : null;
  if (previousType === 'run') {
    if (choices.includes('strength')) return { type: 'strength', reason: 'Du løp i går. I dag foreslår vi styrke for litt variasjon.' };
    if (choices.includes('rest')) return { type: 'rest', reason: 'Du løp i går. I dag passer det med hvile. Styrke er ikke et valg i søndagsplanen din.' };
  }
  if (choices.length === 1) return { type: choices[0], reason: 'En liten avtale med deg selv, fra ukeplanen din.' };
  if (choices.includes('ballet')) return { type: 'ballet', reason: 'Ballett er førstevalget på torsdager. Du kan også velge styrke.' };
  if (parseDate(key).getDay() === 0) return { type: 'rest', reason: 'Søndagen er valgfri. Ta fri, eller velg en rolig løpetur hvis du har lyst.' };
  return { type: 'run', reason: 'Litt frisk luft passer fint i dag. Du kan også velge styrke.' };
}
export function planned(key, state) {
  const rec = recommend(key, state);
  return { ...rec, type: state.days[key]?.type ?? rec.type };
}
export function required(key) { return [1, 2, 3, 4, 6].includes(parseDate(key).getDay()); }
export function stats(state, today = dateKey()) {
  const done = Object.entries(state.days).filter(([key, day]) => key >= state.startDate && key <= today && day.completed && day.type !== 'rest');
  let streak = 0;
  for (let key = today; key >= state.startDate; key = addDays(key, -1)) {
    const day = state.days[key];
    if (day?.completed && day.type !== 'rest') { if (required(key)) streak++; continue; }
    if (!required(key) || key === today) continue;
    break;
  }
  const start = monday(today);
  const weekDone = done.filter(([key]) => key >= start && key <= addDays(start, 6));
  return { total: done.length, streak, week: weekDone.length, plannedWeek: weekDone.filter(([key]) => required(key)).length };
}
export function validState(value) {
  const validDate = key => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(parseDate(key).getTime()) && dateKey(parseDate(key)) === key;
  if (!value || value.version !== 1 || !validDate(value.startDate) || value.startDate > dateKey() || !value.days || typeof value.days !== 'object' || Array.isArray(value.days)) return false;
  if (!Array.isArray(value.claimed) || value.claimed.some(t => !REWARDS.some(r => r.target === t))) return false;
  return Object.entries(value.days).every(([key, d]) => validDate(key) && key >= value.startDate && d && options(key).includes(d.type) && typeof d.completed === 'boolean' && (!d.completed || (d.type !== 'rest' && key <= dateKey())) && Array.isArray(d.exercises) && d.exercises.every(id => EXERCISES.some(e => e.id === id)) && new Set(d.exercises).size === d.exercises.length && (!d.completed || d.type !== 'strength' || d.exercises.length === EXERCISES.length));
}
