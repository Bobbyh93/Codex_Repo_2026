import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

test('shared record, authorization, idempotency, corrections and restart recovery', async t => {
  const data = mkdtempSync(path.join(tmpdir(), 'code-shift-test-'));
  const port = 44319; let child;
  async function start() { child = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, DATA_DIR: data, PORT: String(port), INSTRUCTOR_PASSWORD: 'test-only-key' }, stdio: 'pipe' }); await new Promise((resolve,reject) => { child.stdout.once('data',resolve); child.once('error',reject); child.once('exit', code => reject(new Error(`Server exited ${code}`))); }); }
  async function stop() { if (!child || child.exitCode !== null || child.signalCode !== null) return; await new Promise(resolve => { child.once('exit',resolve); child.kill(); }); }
  t.after(stop); await start();
  function client() { let cookie=''; return async (url, body, method) => { const r=await fetch(`http://127.0.0.1:${port}/api/${url}`, { method: method || (body ? 'POST' : 'GET'), headers: { cookie, ...(body ? { 'Content-Type':'application/json' } : {}) }, ...(body ? { body:JSON.stringify(body) } : {}) }); if (r.headers.get('set-cookie')) cookie=r.headers.get('set-cookie').split(';')[0]; return { status:r.status, body:await r.json() }; }; }
  const instructor=client(), guest=client(), students=[client(),client(),client()];
  assert.equal((await guest('state')).status,401);
  assert.equal((await instructor('login',{password:'wrong'})).status,401);
  assert.equal((await instructor('login',{password:'test-only-key'})).status,200);
  assert.equal((await instructor('sessions',{groupName:'Test Group',names:['A','B','C'],activeMeds:['heparin-sq','asa','bogus']})).status,201);
  assert.equal((await instructor('sessions',{groupName:'Second',names:['D','E','F']})).status,409);
  const lobby=(await guest('lobby')).body;
  for(let i=0;i<3;i++) assert.equal((await students[i]('join',{actorId:lobby.roster[i].id,role:'instructor'})).status,200);
  const payloads=students.map((_,i)=>({action:'NOTE_RECORDED',text:`Test note ${i}`,submissionId:`note-${i}`,actor_id:'forged',recorded_at:'1900-01-01'}));
  const notes=await Promise.all(students.map((c,i)=>c('entries',payloads[i])));
  for(let i=0;i<3;i++) { assert.equal(notes[i].status,201); assert.equal(notes[i].body.entry.actor_id,lobby.roster[i].id); assert.ok(Date.parse(notes[i].body.entry.recorded_at)>Date.now()-10000); }
  const retry=await students[0]('entries',payloads[0]); assert.equal(retry.status,200); assert.equal(retry.body.entry.id,notes[0].body.entry.id);
  assert.equal((await students[0]('entries',{...payloads[0],text:'Changed payload'})).status,409);
  assert.equal((await students[0]('entries',{action:'OBSERVATION_RECORDED',text:'forged',submissionId:'forged',role:'instructor'})).status,403);
  assert.equal((await students[0]('status',{status:'ended',role:'instructor'})).status,403);
  assert.equal((await students[0]('export')).status,403);
  const flag=(await instructor('entries',{action:'OBSERVATION_RECORDED',text:'PRIVATE OBSERVATION',submissionId:'flag-1',linkedId:notes[0].body.entry.id})).body.entry;
  const privateCorrection=await instructor('entries',{action:'CORRECTION_RECORDED',text:'PRIVATE CORRECTION',submissionId:'flag-correction',linkedId:flag.id}); assert.equal(privateCorrection.status,201);
  for(const c of students) { const state=(await c('state')).body; assert.equal(state.entries.filter(e=>e.action==='NOTE_RECORDED').length,3); assert.ok(!JSON.stringify(state).includes('PRIVATE')); assert.ok(!state.entries.some(e=>e.private)); assert.equal(state.scenario.patient.name,'Carl Shapiro'); assert.equal(state.scenario.facilitator,undefined); assert.ok(!JSON.stringify(state).includes('Titrate heparin')); }
  assert.ok((await instructor('state')).body.scenario.facilitator.groups.length===5);
  assert.equal((await students[0]('entries',{action:'CORRECTION_RECORDED',text:'Not my note',submissionId:'bad-correct',linkedId:notes[1].body.entry.id})).status,400);
  assert.equal((await students[0]('entries',{action:'CORRECTION_RECORDED',text:'My correction',submissionId:'correct',linkedId:notes[0].body.entry.id})).status,201);
  assert.equal((await students[0]('entries',{action:'NOTE_RECORDED',text:'   ',submissionId:'blank'})).status,400);
  const v={hr:112,rr:24,spo2:92,sbp:168,dbp:96,temp:37.2,rhythm:'sinus_tach_pvc',transitionSeconds:0};
  assert.equal((await students[0]('vitals',{...v,submissionId:'v-forged'})).status,403);
  assert.equal((await students[0]('entries',{action:'VITALS_RECORDED',submissionId:'vr-early'})).status,400);
  assert.equal((await instructor('vitals',{...v,hr:400,submissionId:'v-bad'})).status,400);
  assert.equal((await instructor('vitals',{...v,dbp:170,submissionId:'v-bad2'})).status,400);
  assert.equal((await instructor('vitals',{...v,rhythm:'made-up',submissionId:'v-bad3'})).status,400);
  const vset=await instructor('vitals',{...v,submissionId:'v-1'}); assert.equal(vset.status,201); assert.equal(vset.body.vitals.hr,112);
  const vretry=await instructor('vitals',{...v,submissionId:'v-1'}); assert.equal(vretry.status,200); assert.equal(vretry.body.vitals.id,vset.body.vitals.id);
  const sv=(await students[0]('state')).body; assert.equal(sv.vitals.hr,112); assert.equal(sv.vitals.rhythm,'sinus_tach_pvc'); assert.ok(sv.rhythms.nsr); assert.ok(sv.entries.some(e=>e.action==='VITALS_SET' && e.text.includes('HR 112')));
  const rec=await students[0]('entries',{action:'VITALS_RECORDED',submissionId:'vr-1',text:'forged text'}); assert.equal(rec.status,201); assert.match(rec.body.entry.text,/HR 112 .* BP 168\/96/); assert.ok(!rec.body.entry.text.includes('forged')); assert.equal(rec.body.entry.linked_id,vset.body.vitals.entry_id);
  const trend=await instructor('vitals',{...v,hr:60,transitionSeconds:600,submissionId:'v-2'}); assert.equal(trend.status,201); assert.equal(trend.body.vitals.from_hr,112); assert.equal(trend.body.vitals.hr,60);
  assert.equal((await instructor('vitals',{...v,monitorOn:false,submissionId:'v-off'})).status,201);
  assert.equal((await students[0]('entries',{action:'VITALS_RECORDED',submissionId:'vr-off'})).status,400);
  assert.equal((await instructor('vitals',{...v,submissionId:'v-on'})).status,201);
  const st=(await students[0]('state')).body, ids=st.medications.map(m=>m.id);
  assert.ok(ids.includes('asa') && ids.includes('ntg-sl') && ids.includes('heparin-sq') && !ids.includes('morphine'));
  assert.equal(st.medications.find(m=>m.id==='asa').status,'due');
  // students never receive codes (reading a code off the screen is not scanning); instructors do
  assert.equal(st.scenario.patient.wristband,undefined); assert.ok(st.scenario.medications.every(m=>m.barcode===undefined)); assert.ok(st.medications.every(m=>m.barcode===undefined)); assert.ok(!JSON.stringify(st).includes("MED-ASA325")); assert.equal(st.barcodes,undefined);
  const ist=(await instructor('state')).body; assert.equal(ist.scenario.patient.wristband,'CS-12049023'); assert.equal(ist.session.scan_required,1); assert.deepEqual(ist.barcodes,[]);
  assert.equal((await students[0]('meds',{medId:'morphine',action:'given',patientCode:'CS-12049023',medCode:'MED-MORPH',verification:'camera',submissionId:'m-inactive'})).status,400);
  assert.equal((await students[0]('meds',{medId:'asa',action:'given',patientCode:'CS-12049023',verification:'camera',submissionId:'m-nocode'})).status,400);
  assert.equal((await students[0]('meds',{medId:'asa',action:'held',submissionId:'m-noreason'})).status,400);
  // scan required by default: manual entry is rejected outright
  const manualBlocked=await students[1]('meds',{medId:'metoprolol',action:'given',patientCode:'CS-12049023',medCode:'MED-METO25',verification:'manual',reason:'typed',submissionId:'m-manual-denied'}); assert.equal(manualBlocked.status,400); assert.match(manualBlocked.body.error,/requires scanning/);
  const wrong=await students[0]('meds',{medId:'asa',action:'given',patientCode:'CS-12049023',medCode:'MED-METO25',verification:'camera',submissionId:'m-wrong'}); assert.equal(wrong.status,201); assert.equal(wrong.body.blocked,true); assert.equal(wrong.body.entry.action,'MED_BLOCKED'); assert.match(wrong.body.entry.text,/WRONG MEDICATION.*Metoprolol/);
  const wrongPt=await students[0]('meds',{medId:'asa',action:'given',patientCode:'CS-000',medCode:'MED-ASA325',verification:'camera',submissionId:'m-wrongpt'}); assert.equal(wrongPt.body.blocked,true); assert.match(wrongPt.body.entry.text,/UNRECOGNIZED WRISTBAND/);
  const swapped=await students[0]('meds',{medId:'asa',action:'given',patientCode:'MED-ASA325',medCode:'CS-12049023',verification:'camera',submissionId:'m-swapped'}); assert.equal(swapped.body.blocked,true); assert.match(swapped.body.entry.text,/WRONG PATIENT.*medication label/);
  // scan trail: each read is verified immediately; mismatches are evidence
  const scanA=await students[0]('meds/scan',{attemptId:'att-1',medId:'asa',kind:'patient',code:' cs-12049023 ',source:'camera',format:'CODE_128'}); assert.equal(scanA.status,201); assert.equal(scanA.body.matched,true); assert.equal(scanA.body.patient.name,'Carl Shapiro');
  const scanB=await students[0]('meds/scan',{attemptId:'att-1',medId:'asa',kind:'med',code:'MED-METO25',source:'camera'}); assert.equal(scanB.body.matched,false); assert.match(scanB.body.alert,/WRONG MEDICATION.*Metoprolol/);
  const scanC=await students[0]('meds/scan',{attemptId:'att-1',medId:'asa',kind:'med',code:'ZZZ-UNKNOWN',source:'camera'}); assert.equal(scanC.body.matched,false); assert.match(scanC.body.alert,/UNRECOGNIZED LABEL/);
  assert.equal((await students[0]('meds/scan',{attemptId:'att-1',medId:'asa',kind:'med',code:'MED-ASA325',source:'manual'})).status,400);
  assert.equal((await students[0]('meds/scan',{attemptId:'att-1',medId:'asa',kind:'med',code:'MED-ASA325',source:'camera'})).body.matched,true);
  { const e=(await students[1]('state')).body.entries.filter(e=>e.action==='MED_SCAN_MISMATCH'); assert.equal(e.length,2); assert.match(e[0].text,/WRONG MEDICATION/); }
  assert.equal((await students[1]('state')).body.medications.find(m=>m.id==='asa').mismatchCount,2);
  // scan order and timing are recorded; normalization accepts lowercase/whitespace
  const t0=new Date(Date.now()-20000).toISOString(), t1=new Date(Date.now()-5000).toISOString();
  const given=await students[0]('meds',{medId:'asa',action:'given',patientCode:' cs-12049023 ',medCode:'med-asa325',verification:'camera',patientScannedAt:t0,medScannedAt:t1,submissionId:'m-asa'}); assert.equal(given.status,201); assert.equal(given.body.blocked,false); assert.equal(given.body.entry.action,'MED_GIVEN'); assert.match(given.body.entry.text,/camera scan/); assert.match(given.body.entry.text,/wristband then label, 15 s apart/); assert.match(given.body.entry.text,/SBP 168/); assert.equal(given.body.event.scan_order,'patient_first'); assert.equal(given.body.event.patient_code,'CS-12049023');
  const givenRetry=await students[0]('meds',{medId:'asa',action:'given',patientCode:' cs-12049023 ',medCode:'med-asa325',verification:'camera',patientScannedAt:t0,medScannedAt:t1,submissionId:'m-asa'}); assert.equal(givenRetry.status,200); assert.equal(givenRetry.body.event.id,given.body.event.id);
  const again=await students[1]('meds',{medId:'asa',action:'given',patientCode:'CS-12049023',medCode:'MED-ASA325',verification:'camera',submissionId:'m-asa-again'}); assert.equal(again.status,409); assert.equal(again.body.alerts[0].code,'ALREADY_GIVEN');
  assert.equal((await students[1]('state')).body.medications.find(m=>m.id==='asa').alerts[0].code,'ALREADY_GIVEN');
  const againAck=await students[1]('meds',{medId:'asa',action:'given',patientCode:'CS-12049023',medCode:'MED-ASA325',verification:'camera',acknowledgeAlerts:true,overrideReason:'provider ordered second dose',patientScannedAt:t0,medScannedAt:t1,submissionId:'m-asa-again-ack'}); assert.equal(againAck.status,201); assert.match(againAck.body.entry.text,/ALERTS OVERRIDDEN \(provider ordered second dose\): already given/);
  const medFirst=await students[1]('meds',{medId:'metoprolol',action:'given',patientCode:'CS-12049023',medCode:'MED-METO25',verification:'camera',patientScannedAt:t1,medScannedAt:t0,submissionId:'m-meto'}); assert.equal(medFirst.body.blocked,false); assert.match(medFirst.body.entry.text,/SEQUENCE: medication scanned before patient/); assert.equal(medFirst.body.event.scan_order,'med_first');
  // instructor relaxes the scan requirement: manual entry then needs a reason and is flagged
  assert.equal((await students[0]('session-settings',{scanRequired:false})).status,403);
  assert.equal((await instructor('session-settings',{scanRequired:'no'})).status,400);
  assert.equal((await instructor('session-settings',{scanRequired:false})).status,200);
  assert.equal((await students[1]('meds',{medId:'lr',action:'given',patientCode:'CS-12049023',medCode:'MED-LR1000',verification:'manual',submissionId:'m-manual-noreason'})).status,400);
  const manual=await students[1]('meds',{medId:'lr',action:'given',patientCode:'CS-12049023',medCode:'MED-LR1000',verification:'manual',reason:'camera would not read the bag',submissionId:'m-manual'}); assert.equal(manual.status,201); assert.match(manual.body.entry.text,/MANUAL ENTRY \(camera would not read the bag\)/); assert.ok(!manual.body.entry.text.includes('camera scan'));
  assert.equal((await instructor('session-settings',{scanRequired:true})).status,200);
  assert.ok((await instructor('state')).body.entries.filter(e=>e.action==='SESSION_SETTING_CHANGED').length===2);
  // physical barcodes: instructor registers the code printed on a real sim med; students' scans of it resolve
  assert.equal((await students[0]('barcodes',{code:'0312345678901',targetType:'med',targetId:'ntg-sl'})).status,403);
  assert.equal((await instructor('barcodes',{code:'MED-ASA325',targetType:'med',targetId:'ntg-sl'})).status,409);
  assert.equal((await instructor('barcodes',{code:'0312345678901',targetType:'med',targetId:'nope'})).status,400);
  const reg=await instructor('barcodes',{code:' 0312 3456 78901 ',targetType:'med',targetId:'ntg-sl',label:'Demo Dose NTG SL bottle'}); assert.equal(reg.status,201); assert.equal(reg.body.barcodes[0].code,'0312345678901');
  const look=(await instructor('barcodes/lookup?code=0312345678901')).body; assert.equal(look.match.medId,'ntg-sl'); assert.equal(look.match.source,'registered');
  assert.equal((await instructor('barcodes/lookup?code=UNKNOWN-1')).body.match,null);
  const wb=await instructor('barcodes',{code:'WB-REAL-001',targetType:'patient',targetId:'patient',label:'Printed wristband from supply room'}); assert.equal(wb.status,201);
  assert.equal((await instructor('vitals',{...v,sbp:86,dbp:50,submissionId:'v-low'})).status,201);
  const ntgNoAck=await students[0]('meds',{medId:'ntg-sl',action:'given',patientCode:'WB-REAL-001',medCode:'0312345678901',verification:'camera',indication:'chest pain',submissionId:'m-ntg'}); assert.equal(ntgNoAck.status,409); assert.equal(ntgNoAck.body.alerts[0].code,'HOLD_RULE'); assert.match(ntgNoAck.body.error,/SBP 86 is below 100/);
  assert.equal((await students[0]('meds',{medId:'ntg-sl',action:'given',patientCode:'WB-REAL-001',medCode:'0312345678901',verification:'camera',acknowledgeAlerts:true,overrideReason:'provider aware',submissionId:'m-ntg-noind'})).status,400);
  const ntg=await students[0]('meds',{medId:'ntg-sl',action:'given',patientCode:'WB-REAL-001',medCode:'0312345678901',verification:'camera',acknowledgeAlerts:true,overrideReason:'provider aware',indication:'chest pain',indicationValue:'8/10',submissionId:'m-ntg'}); assert.match(ntg.body.entry.text,/indication: chest pain 8\/10/); assert.equal(ntg.body.event.indication,'chest pain'); assert.equal(ntg.status,201); assert.equal(ntg.body.blocked,false); assert.match(ntg.body.entry.text,/ALERTS OVERRIDDEN \(provider aware\): hold rule .* SBP 86 is below 100/); assert.equal(JSON.parse(ntg.body.event.alerts)[0].code,'HOLD_RULE'); assert.equal(ntg.body.event.override_reason,'provider aware');
  const ntg2=await students[0]('meds',{medId:'ntg-sl',action:'given',patientCode:'WB-REAL-001',medCode:'0312345678901',verification:'camera',indication:'chest pain',submissionId:'m-ntg-2x'}); assert.equal(ntg2.status,409); assert.deepEqual(ntg2.body.alerts.map(a=>a.code).sort(),['HOLD_RULE','TOO_EARLY']);
  assert.equal((await instructor('barcodes',{code:'0312345678901',targetType:'med',targetId:'ntg-sl',active:false})).status,201);
  const removed=await students[0]('meds',{medId:'ntg-sl',action:'given',patientCode:'WB-REAL-001',medCode:'0312345678901',verification:'camera',indication:'chest pain',submissionId:'m-ntg-2'}); assert.equal(removed.body.blocked,true); assert.match(removed.body.entry.text,/not a known medication/);
  assert.ok((await instructor('state')).body.entries.filter(e=>e.action==='BARCODE_REGISTERED').length===3);
  assert.equal((await students[0]('meds',{medId:'ntg-td',action:'held',reason:'SBP 86',submissionId:'m-hold-noscan'})).status,400);
  const held=await students[0]('meds',{medId:'ntg-td',action:'held',reason:'SBP 86',patientCode:'WB-REAL-001',verification:'camera',submissionId:'m-hold'}); assert.equal(held.status,201); assert.equal(held.body.entry.action,'MED_HELD'); assert.match(held.body.entry.text,/patient identified by wristband scan/); assert.match(held.body.entry.text,/alerts at the time: SBP 86 is below 100/); assert.equal(held.body.event.patient_match,1);
  const heldWrong=await students[0]('meds',{medId:'ntg-td',action:'held',reason:'x',patientCode:'MED-ASA325',verification:'camera',submissionId:'m-hold-wrong'}); assert.equal(heldWrong.body.blocked,true); assert.match(heldWrong.body.entry.text,/WRONG PATIENT/);
  { const vlast=(await instructor('state')).body.vitals; assert.equal(held.body.entry.linked_id,vlast.entry_id); }
  assert.equal((await instructor('vitals',{...v,sbp:148,dbp:88,submissionId:'v-148'})).status,201);
  const heldOk=await students[0]('meds',{medId:'ntg-td',action:'held',reason:'patient asleep',patientCode:'WB-REAL-001',verification:'camera',submissionId:'m-hold-148'}); assert.match(heldOk.body.entry.text,/hold rule not met \(SBP 148, order holds below 100\)/);
  assert.equal((await instructor('vitals',{...v,monitorOn:false,submissionId:'v-off2'})).status,201);
  const offGive=await students[0]('meds',{medId:'ntg-td',action:'given',patientCode:'WB-REAL-001',medCode:'MED-NTGTD1',verification:'camera',submissionId:'m-ntg-off'}); assert.equal(offGive.status,201); assert.match(offGive.body.entry.text,/hold rule not evaluated \(monitor off\)/);
  assert.equal((await instructor('vitals',{...v,sbp:86,dbp:50,submissionId:'v-low-again'})).status,201);
  assert.equal((await students[0]('events/release',{eventId:'ev-labs',submissionId:'ev-x'})).status,403);
  assert.equal((await instructor('events/release',{eventId:'nope',submissionId:'ev-x'})).status,400);
  { const before=(await instructor('state')).body.vitals.id; const rel=await instructor('events/release',{eventId:'ev-chest-pain',submissionId:'ev-1'}); assert.equal(rel.status,201); assert.match(rel.body.entry.text,/Chest pain episode .* 8\/10/); const st=(await students[0]('state')).body; assert.ok(st.vitals.id>before); assert.equal(st.vitals.hr,118); assert.equal(st.vitals.transition_seconds,45); assert.equal(st.released.length,1); assert.ok(!JSON.stringify(st.scenario.events).includes('Patient voice')); assert.ok(JSON.stringify((await instructor('state')).body.scenario.events).includes('Patient voice')); assert.equal((await instructor('events/release',{eventId:'ev-chest-pain',submissionId:'ev-1'})).status,200); }
  assert.equal((await instructor('vitals',{...v,sbp:148,dbp:88,submissionId:'v-148b'})).status,201);
  assert.equal((await students[0]('assessments',{type:'head_to_toe',systems:[],submissionId:'as-0'})).status,400);
  assert.equal((await students[0]('assessments',{type:'head_to_toe',systems:[{system:'cardiac',wdl:false,findings:''}],submissionId:'as-1'})).status,400);
  const as=await students[0]('assessments',{type:'head_to_toe',systems:[{system:'neuro',wdl:true},{system:'cardiac',findings:'dull chest pain 6/10, regular rate, no edema'},{system:'resp',wdl:true}],submissionId:'as-2'}); assert.equal(as.status,201); assert.equal(as.body.entry.action,'ASSESSMENT_RECORDED'); assert.match(as.body.entry.text,/Head-to-toe assessment .* Neuro: WDL .* Cardiovascular: dull chest pain 6\/10/); assert.match(as.body.entry.text,/monitor: HR 112/); assert.equal(JSON.parse(as.body.assessment.systems).length,3);
  const re=await students[1]('assessments',{type:'focused',systems:[{system:'pain',findings:'chest pain 2/10 after NTG'}],submissionId:'as-3'}); assert.equal(re.status,201); assert.equal(re.body.entry.linked_id,as.body.entry.id); assert.match(re.body.entry.text,/Focused reassessment/);
  assert.equal((await students[1]('assessments',{type:'focused',systems:[{system:'pain',findings:'chest pain 2/10 after NTG'}],submissionId:'as-3'})).status,200);
  { assert.equal((await students[0]('patient/ask',{transcript:'',submissionId:'pa-0'})).status,400);
    const q1=await students[0]('patient/ask',{transcript:"Hi Mr. Shapiro, I'm your nurse today. Can you tell me your name and date of birth?",source:'voice',submissionId:'pa-1'}); assert.equal(q1.status,201); assert.ok(q1.body.reply.length>5); assert.ok(['ai','scripted'].includes(q1.body.brain)); if(q1.body.brain==='scripted'){ assert.equal(q1.body.intent,'identify'); assert.match(q1.body.reply,/Carl Shapiro/); }
    const q2=await students[0]('patient/ask',{transcript:'Do you take anything like Viagra?',source:'voice',submissionId:'pa-2'}); if(q2.body.brain==='scripted'){ assert.equal(q2.body.intent,'sildenafil'); assert.ok(q2.body.cues[0].includes('PDE5')); }
    const ex1=await students[0]('patient/ask',{transcript:'I am going to listen to your lungs now, take a deep breath for me',source:'voice',submissionId:'ex-1'}); assert.equal(ex1.status,201); assert.equal(ex1.body.exam.id,'lungs'); assert.equal(ex1.body.exam.sound,'breath'); assert.ok(ex1.body.exam.finding.length>10);
    const ex2=await students[0]('patient/ask',{transcript:'Can you squeeze my hands? And tell me where you are right now',source:'voice',submissionId:'ex-2'}); assert.equal(ex2.body.exam.system,'neuro');
    const ex3=await students[0]('patient/ask',{transcript:'Let me listen to your heart',source:'voice',submissionId:'ex-3'}); assert.equal(ex3.body.exam.system,'cardiac');
    { const st=(await students[1]('state')).body; assert.equal(st.entries.filter(e=>e.action==='EXAM_FINDING').length,3); const disp=await fetch(`http://127.0.0.1:${port}/api/display`).then(r=>r.json()); assert.equal(disp.exam.label,'Heart sounds'); assert.equal(disp.exam.sound,'heart'); assert.equal(st.worklist.find(t=>t.key==='t-focused').status,'done'); }
    const q3=await students[0]('patient/ask',{transcript:'zzqx',source:'voice',submissionId:'pa-3'}); if(q3.body.brain==='scripted'){ assert.equal(q3.body.intent,null); }
    assert.equal((await students[0]('patient/ask',{transcript:'Hi Mr. Shapiro, I\'m your nurse today. Can you tell me your name and date of birth?',source:'voice',submissionId:'pa-1'})).status,200);
    const ents=(await students[1]('state')).body.entries; assert.equal(ents.filter(e=>e.action==='PATIENT_ASKED').length,6); assert.equal(ents.filter(e=>e.action==='PATIENT_SAID').length,6); assert.match(ents.find(e=>e.action==='PATIENT_ASKED').text,/cue: identity|not understood/);
    const disp=await fetch(`http://127.0.0.1:${port}/api/display`).then(r=>r.json()); assert.equal(disp.conversation.length,2); assert.equal(disp.conversation[1].who,'patient'); }
  { const wl=(await students[0]('state')).body.worklist; assert.ok(wl.some(t=>t.key==='t-monitor') && wl.some(t=>t.kind==='med') && wl.some(t=>t.kind==='result') && wl.some(t=>t.key==='t-reassess-ntg'), JSON.stringify(wl.map(t=>t.key)));
    assert.equal((await students[0]('tasks/done',{key:'nope'})).status,400); assert.equal((await students[0]('tasks/done',{key:'t-monitor'})).status,200); assert.equal((await students[0]('tasks/done',{key:'t-monitor'})).body.already,true);
    assert.equal((await students[0]('tasks/review',{key:'t-monitor',status:'confirmed'})).status,403); assert.equal((await instructor('tasks/review',{key:'t-ecg-1',status:'confirmed'})).status,400); assert.equal((await instructor('tasks/review',{key:'t-monitor',status:'confirmed'})).status,200);
    const wl2=(await instructor('state')).body.worklist; const tm=wl2.find(t=>t.key==='t-monitor'); assert.equal(tm.status,'confirmed'); assert.equal(tm.done_name,'A'); assert.ok((await instructor('state')).body.entries.some(e=>e.action==='TASK_CONFIRMED')); }
  { const ist2=(await instructor('state')).body; assert.equal(ist2.assessments.length,2); assert.equal((await students[0]('state')).body.assessments,undefined); }
  { const ist2=(await instructor('state')).body; assert.ok(Array.isArray(ist2.med_events) && ist2.med_events.length>5); assert.ok(Array.isArray(ist2.med_scans) && ist2.med_scans.length===4); assert.equal((await students[0]('state')).body.med_events,undefined); }
  const marNow=(await students[1]('state')).body.medications; assert.equal(marNow.find(m=>m.id==='asa').status,'given'); assert.equal(marNow.find(m=>m.id==='asa').blockedCount,3); assert.equal(marNow.find(m=>m.id==='ntg-td').status,'given'); assert.equal(marNow.find(m=>m.id==='asa').last.verification,'camera'); assert.equal(marNow.find(m=>m.id==='asa').last.scan_order,'patient_first'); assert.equal(marNow.find(m=>m.id==='lr').manualCount,1);
  assert.equal((await students[0]('meds/orders',{medId:'morphine',active:true})).status,403);
  assert.equal((await instructor('meds/orders',{medId:'morphine',active:true})).status,200); assert.ok((await students[0]('state')).body.medications.some(m=>m.id==='morphine'));
  assert.equal((await instructor('meds/orders',{medId:'asa',active:false})).status,400);
  assert.equal((await students[0]('entries',{action:'PROVIDER_MESSAGE',text:'free text',submissionId:'pm-free'})).status,400);
  assert.equal((await students[0]('provider',{situationId:'s-chest-pain',recommendationId:'nope',submissionId:'pm-bad'})).status,400);
  const pm=await students[0]('provider',{situationId:'s-chest-pain',recommendationId:'r-orders',submissionId:'pm-1'}); assert.equal(pm.status,201); assert.match(pm.body.entry.text,/^S: Chest pain .* B: Carl Shapiro.* R: Request new orders/);
  assert.equal((await students[0]('provider/reply',{messageId:pm.body.entry.id,replyId:'p-morphine',submissionId:'pr-forged'})).status,403);
  assert.equal((await instructor('provider/reply',{messageId:pm.body.entry.id,replyId:'nope',submissionId:'pr-bad'})).status,400);
  const pr=await instructor('provider/reply',{messageId:pm.body.entry.id,replyId:'p-morphine',submissionId:'pr-1'}); assert.equal(pr.status,201); assert.equal(pr.body.entry.linked_id,pm.body.entry.id); assert.match(pr.body.entry.text,/^Provider: Give morphine/);
  { const st2=(await students[0]('state')).body; const fresh=st2.orders.filter(o=>o.source==='provider_reply'); assert.equal(fresh.length,2); assert.ok(fresh.every(o=>!o.acknowledged)); assert.ok(st2.medications.some(m=>m.id==='morphine')); assert.ok(st2.orders.some(o=>o.source==='standing' && o.category==='Protocols')); assert.ok(['overdue','due','upcoming','prn','continuous','complete'].includes(st2.medications[0].window));
    assert.equal((await students[0]('orders/ack',{orderId:'ord-999'})).status,400);
    assert.equal((await students[0]('orders/ack',{orderId:fresh[0].id})).status,200); const st3=(await students[1]('state')).body; const acked=st3.orders.find(o=>o.id===fresh[0].id); assert.equal(acked.acknowledged,true); assert.equal(acked.acknowledged_name,'A'); assert.ok(st3.entries.some(e=>e.action==='ORDER_ACKNOWLEDGED')); assert.ok(st3.entries.filter(e=>e.action==='ORDER_PLACED').length===2);
    assert.equal((await instructor('provider/reply',{messageId:pm.body.entry.id,replyId:'p-morphine',submissionId:'pr-1'})).status,200); assert.equal((await students[1]('state')).body.orders.filter(o=>o.source==='provider_reply').length,2); }
  const disp=await fetch(`http://127.0.0.1:${port}/api/display`).then(r=>r.json()); assert.equal(disp.vitals.sbp,148); assert.equal(disp.patient.name,'Carl Shapiro'); assert.ok(!JSON.stringify(disp).includes('PRIVATE'));
  const before=(await instructor('state')).body;
  assert.ok(before.entries.every(e=>e.actor_name && e.recorded_at && ['system_logged','instructor_observed'].includes(e.source)));
  assert.deepEqual(before.entries.map(e=>e.id),before.entries.map(e=>e.id).sort((a,b)=>a-b));
  assert.equal((await students[0]('entries',{},'DELETE')).status,404);
  await stop(); await start();
  const after=(await instructor('state')).body; assert.deepEqual(after.entries,before.entries);
  for (const c of students) assert.equal((await c('state')).body.entries.filter(e=>e.action==='NOTE_RECORDED').length,3);
  assert.equal((await instructor('status',{status:'paused'})).status,200);
  assert.equal((await students[0]('entries',{...payloads[0],submissionId:'paused-new'})).status,409);
  assert.equal((await students[0]('entries',payloads[0])).status,200);
  assert.equal((await instructor('status',{status:'active'})).status,200);
  assert.equal((await instructor('status',{status:'ended'})).status,200);
  assert.equal((await instructor('status',{status:'active'})).status,409);
  { const ex=(await instructor('export')).body; assert.equal(ex.format,'code-shift-evidence-v2'); assert.ok(ex.med_events.length && ex.med_scans.length); }
  await stop();
  const db=new DatabaseSync(path.join(data,'code-shift.sqlite'));
  assert.throws(()=>db.exec('DELETE FROM entries'),/append-only/); assert.throws(()=>db.exec('DELETE FROM vitals'),/append-only/); assert.throws(()=>db.exec('DELETE FROM med_events'),/append-only/); assert.throws(()=>db.exec('DELETE FROM med_scans'),/append-only/); assert.throws(()=>db.exec('DELETE FROM assessments'),/append-only/); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM barcode_aliases').get().n,2); assert.throws(()=>db.exec('UPDATE vitals SET hr=1'),/append-only/);
  assert.throws(()=>db.exec("UPDATE entries SET text='tampered'"),/append-only/); db.close();
});
