import test from 'node:test';
import assert from 'node:assert/strict';
import { options, recommend, stats, dateKey, addDays, monday, validState, EXERCISES, strengthWorkout, STRENGTH_PLANS } from '../planner.js';
const make = (days = {}) => ({ version: 1, startDate: '2026-10-19', days, claimed: [] });
const done = (type, exercises = []) => ({ type, completed: true, exercises });
test('ukeplanen har riktige valg og torsdag starter med ballett', () => {
  assert.deepEqual(options('2026-10-19'), ['ballet']);
  assert.deepEqual(options('2026-10-20'), ['walk']);
  assert.deepEqual(options('2026-10-21'), ['strength']);
  assert.deepEqual(options('2026-10-22'), ['ballet','strength']);
  assert.deepEqual(options('2026-10-23'), ['rest']);
  assert.deepEqual(options('2026-10-24'), ['run','strength']);
  assert.deepEqual(options('2026-10-25'), ['run','rest']);
  assert.equal(recommend('2026-10-22',make()).type,'ballet');
});
test('løping dagen før gir styrke der styrke er et tillatt valg', () => {
  const s=make({'2026-10-23':done('run')});
  assert.equal(recommend('2026-10-24',s).type,'strength');
});
test('søndag etter løping lørdag anbefaler hvile innenfor søndagens valg', () => {
  assert.equal(recommend('2026-10-25',make({'2026-10-24':done('run')})).type,'rest');
});
test('en planlagt men ikke utført økt påvirker ikke anbefalingen', () => {
  const s=make({'2026-10-23':{type:'run',completed:false,exercises:[]}});
  assert.equal(recommend('2026-10-24',s).type,'run');
});
test('hvile og valgfri søndag bryter ikke streak', () => {
  const s=make({'2026-10-19':done('ballet'),'2026-10-20':done('walk'),'2026-10-21':done('strength'), '2026-10-22':done('ballet'),'2026-10-24':done('run')});
  assert.equal(stats(s,'2026-10-26').streak,5);
  assert.equal(stats(s,'2026-10-27').streak,0);
});
test('valgfri søndag gir belønningspoeng og ikke ekstra planlagt streak', () => {
  const s=make({'2026-10-24':done('strength'),'2026-10-25':done('run')});
  const result=stats(s,'2026-10-25');
  assert.equal(result.total,2); assert.equal(result.streak,1); assert.equal(result.plannedWeek,1); assert.equal(result.week,2);
});
test('registrering og angre endrer tellingen, ikke antall avkryssinger', () => {
  const s=make({'2026-10-21':done('strength',EXERCISES.map(e=>e.id))});
  assert.equal(stats(s,'2026-10-21').total,1);
  s.days['2026-10-21'].completed=false;
  assert.equal(stats(s,'2026-10-21').total,0);
});
test('uker, månedsskifte og lokal dato håndteres uten UTC-forskyvning', () => {
  assert.equal(monday('2026-10-25'),'2026-10-19');
  assert.equal(addDays('2026-10-31',1),'2026-11-01');
  assert.equal(addDays('2026-12-31',1),'2027-01-01');
  assert.equal(dateKey(new Date(2026,9,25,0,1)),'2026-10-25');
});
test('backup-validering avviser feil dager, ugyldige øvelser og uferdig styrke', () => {
  assert.equal(validState(make()),true);
  assert.equal(validState(make({'2026-10-24':done('run')})),true);
  assert.equal(validState(make({'2026-10-24':done('strength')})),false);
  assert.equal(validState(make({'2026-10-23':done('run')})),false);
  assert.equal(validState(make({'2026-02-30':done('run')})),false);
  const s=make();s.claimed=['<script>'];assert.equal(validState(s),false);
  assert.equal(validState(make({'2026-10-21':done('strength',EXERCISES.map(e=>e.id))})),true);
});
test('alle nye økter har én hovedøvelse, to isolasjonsøvelser, bryst, rygg og tre mageøvelser', () => {
  for (const plan of STRENGTH_PLANS) {
    const s=make({'2026-10-21':{type:'strength',completed:false,exercises:[],workoutId:plan.id}});
    const workout=strengthWorkout('2026-10-21',s);
    const count=group=>workout.exercises.filter(e=>e.group.startsWith(group)).length;
    assert.equal(count('Hovedøvelse'),1);assert.ok([2,3].includes(count('Tillegg')));assert.equal(count('Overkropp · bryst'),1);
    assert.equal(workout.exercises.filter(e=>['leg-curl','leg-extension','hip-abduction','kickback'].includes(e.id)).length,2);
    assert.ok([1,2].includes(count('Overkropp · rygg')));assert.equal(count('Mage'),3);
    assert.equal(new Set(workout.exercises.map(e=>e.id)).size,workout.exercises.length);
  }
});
test('rotasjon følger gjennomførte styrkeøkter og hopper ikke over en økt som ble droppet', () => {
  const s=make();
  assert.equal(strengthWorkout('2026-10-21',s).id,'strength-a-v1');
  assert.equal(strengthWorkout('2026-10-24',s).id,'strength-a-v1');
  s.days['2026-10-21']={...done('strength',STRENGTH_PLANS[0].exerciseIds),workoutId:'strength-a-v1'};
  assert.equal(strengthWorkout('2026-10-24',s).id,'strength-b-v1');
  s.days['2026-10-22']={...done('strength',STRENGTH_PLANS[1].exerciseIds),workoutId:'strength-b-v1'};
  assert.equal(strengthWorkout('2026-10-24',s).id,'strength-c-v1');
  assert.equal(validState(s),true);
});
test('fremtidige standardøkter forhåndsviser A, B, C', () => {
  const s=make();
  assert.equal(strengthWorkout('2026-10-28',s,'2026-10-27').id,'strength-a-v1');
  assert.equal(strengthWorkout('2026-11-04',s,'2026-10-27').id,'strength-b-v1');
  assert.equal(strengthWorkout('2026-11-11',s,'2026-10-27').id,'strength-c-v1');
});
test('påbegynt økt og gammel historikk beholder øvelsene sine', () => {
  const s=make({'2026-10-21':{type:'strength',completed:false,exercises:['hip-thrust'],workoutId:'strength-b-v1'}});
  assert.equal(strengthWorkout('2026-10-21',s).id,'strength-b-v1');assert.equal(validState(s),true);
  s.days['2026-10-21']={type:'strength',completed:false,exercises:['squat']};
  assert.equal(strengthWorkout('2026-10-21',s).id,'legacy');assert.equal(validState(s),true);
  s.days['2026-10-21']=done('strength',EXERCISES.map(e=>e.id));
  assert.equal(validState(s),true);assert.equal(strengthWorkout('2026-10-21',s).exercises.length,6);
});
test('sikkerhetskopier av nye økter krever akkurat øvelsene i den lagrede planen', () => {
  const s=make({'2026-10-21':{...done('strength',STRENGTH_PLANS[0].exerciseIds),workoutId:'strength-a-v1'}});
  assert.equal(validState(s),true);
  s.days['2026-10-21'].exercises=s.days['2026-10-21'].exercises.slice(1);assert.equal(validState(s),false);
  s.days['2026-10-21'].completed=false;s.days['2026-10-21'].exercises=['hip-thrust'];assert.equal(validState(s),false);
  s.days['2026-10-21'].workoutId='unknown';assert.equal(validState(s),false);
});
