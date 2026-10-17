// N115C CAD / Chest Pain simulation scenario — Carl Shapiro.
// Fictional educational patient for nursing simulation. Source: faculty instructor packet
// "INSTRUCTOR - N115C CAD Chest Pain - Carl Shapiro - N115C P1". Not a real person; not for clinical use.
// `facilitator` is instructor-only and is stripped from student API responses on the server.
// monitorPresets: the packet gives rhythm/lab events but no numeric vitals; preset numbers are suggested teaching values for faculty to confirm or edit.
export const scenario = {
  id: 'n115c-cad-chest-pain-carl-shapiro-v1',
  name: 'N115C · CAD / Chest Pain · Carl Shapiro',
  course: 'N115C', version: 1,
  patient: { id: 'patient-carl-shapiro', wristband: 'CS-12049023', name: 'Carl Shapiro', mrn: '12049023', age: '54 years', dob: '04/15/1969', sex: 'Male', allergies: 'Peanuts', location: 'University General Hospital, Rm 269', codeStatus: 'Full', advanceDirective: 'None', weight: '110 kg', height: '175 cm', description: 'Fictional simulation patient' },
  admission: { diagnosis: 'Angina', setting: 'Emergency Department, start of shift', lines: 'Lactated Ringers infusing at 25 mL/hour', labsDrawn: 'BMP, CBC, BNP, troponin I', family: 'No family present; no major support available' },
  sbar: [
    ['Situation', 'It is the start of your shift, and you are assigned to Carl Shapiro, a 54-year-old male seeking care in the local Emergency Department with complaints of dull, aching chest pain and shortness of breath.'],
    ['Background', 'He has a history of hypertension and states he takes a "water pill" for his blood pressure. He travels frequently on business and is out of state with no local physician. He describes his work as "stressful". He smokes less than half a pack of cigarettes a day and drinks alcohol occasionally.'],
    ['Assessment', 'Lactated Ringers infusing at 25 mL/hour. Labs were drawn: BMP, CBC, BNP, and troponin I. No family is present.'],
    ['Recommendation', 'Review morning lab results and standing orders.']
  ],
  history: [
    ['Past medical history', 'Coronary artery disease, hypertension, and anxiety. Takes "water pills" for blood pressure (unsure of the name). Has been trying to exercise and lose weight but finds it very hard when travelling. Smokes less than half a pack of cigarettes a day; drinks alcohol occasionally. Describes work as "stressful."'],
    ['History of present illness', 'Has been "pushing" himself lately and feels the "stress" is starting to get to him. He has noticed this type of chest pain before, but it usually goes away when he rests. He started worrying when he began to sweat and became short of breath.'],
    ['Social history', 'Travels frequently on business. Currently in town but does not reside locally. Major support: none available.'],
    ['Surgeries / procedures', 'None.'],
    ['Immunizations', 'Current.']
  ],
  labs: [
    { panel: 'Complete blood count (CBC)', results: [['White blood cells', '5,100', '4,100–10,900 cells/mm³'], ['Hemoglobin', '14.0', '12–15.2 g/dL'], ['Hematocrit', '40', '37–46%']] },
    { panel: 'Basic metabolic panel (BMP)', results: [['Sodium', '137', '135–145 mEq/L'], ['Potassium', '3.5', '3.5–5.0 mEq/L'], ['Calcium', '9.5', '9.0–10.5 mEq/L'], ['Magnesium', '2.0', '1.3–2.1 mg/dL'], ['Phosphorus', '3.5', '3.5–4.5 mg/dL'], ['Glucose', '110', '90–110 mg/dL'], ['BNP (b-type natriuretic peptide)', '200', '<100 pg/mL']] },
    { panel: 'Cardiac and coagulation', results: [['D-dimer', '0.4', '<0.4 mcg/mL'], ['CK-MB', '4.9', '0–4.9 ng/mL'], ['Troponin', '0.1', '<0.1 ng/mL']] }
  ],
  // Scripted events the instructor releases during the SIM. studentText appears on the chart "Updates" panel and the
  // timeline; cue is instructor-only; vitals (optional) are applied to the monitor at release. suggestedMinute is a guide only.
  events: [
    { id: 'ev-ecg-1', title: '12-lead ECG result (first)', suggestedMinute: 5, studentText: '12-lead ECG resulted: sinus tachycardia with occasional PVCs.', cue: 'Release once the team has obtained the first 12-lead. Expect them to notify the provider and review standing orders.', vitals: { hr: 108, rr: 22, spo2: 94, sbp: 152, dbp: 90, temp: 37.0, rhythm: 'sinus_tach_pvc', transitionSeconds: 60 } },
    { id: 'ev-chest-pain', title: 'Chest pain episode', suggestedMinute: 10, studentText: 'Patient reports dull, aching chest pain 8/10, radiating to the left arm, diaphoretic and short of breath.', cue: 'Patient voice: "It\'s back, it\'s squeezing, I feel sweaty." Expect: oxygen for SpO2 below 90, sublingual NTG q5 min up to 3 (hold for SBP below 100), 12-lead, notify provider.', vitals: { hr: 118, rr: 26, spo2: 91, sbp: 168, dbp: 98, temp: 37.1, rhythm: 'sinus_tach_pvc', transitionSeconds: 45 } },
    { id: 'ev-labs', title: 'Troponin and potassium resulted', suggestedMinute: 18, studentText: 'STAT labs resulted: Troponin I 1.00 ng/dL (expected below 0.04). Potassium 2.2 mEq/L. PT 12.5 s, INR 1.0, aPTT 32 s, platelets 220.', cue: 'Elevated troponin: expect provider notification, heparin protocol (loading dose then weight-based drip, PTT q6h), potassium replacement per PRN orders. Hold LMWH while on heparin.' },
    { id: 'ev-hypotension', title: 'Hypotension after nitroglycerin', suggestedMinute: 25, studentText: 'Patient states he feels light-headed. Monitor shows the blood pressure falling.', cue: 'Release after NTG doses. Expect: hold further NTG (SBP below 100), 500 mL NS bolus, may repeat x1, notify provider. Albumin 5% only if crackles.', vitals: { hr: 122, rr: 24, spo2: 92, sbp: 86, dbp: 50, temp: 37.0, rhythm: 'sinus_tach', transitionSeconds: 90 } },
    { id: 'ev-ecg-2', title: '12-lead ECG result (second) and rhythm change', suggestedMinute: 32, studentText: '12-lead ECG resulted: supraventricular tachycardia with a 10-beat run of ventricular tachycardia.', cue: 'Priority assessment: neuro, cardiac, respiratory. Expect provider notification and preparation for deterioration. What can kill the patient: full arrest.', vitals: { hr: 164, rr: 28, spo2: 89, sbp: 92, dbp: 56, temp: 37.0, rhythm: 'svt', transitionSeconds: 30 } },
    { id: 'ev-improving', title: 'Patient improving', suggestedMinute: 40, studentText: 'Patient reports chest pain 2/10 and easier breathing.', cue: 'Release when the team has treated appropriately. Wind down toward debrief.', vitals: { hr: 88, rr: 18, spo2: 97, sbp: 128, dbp: 78, temp: 37.0, rhythm: 'nsr', transitionSeconds: 120 } }
  ],
  // Choice-based provider communication (no free text). Students: situation + recommendation. Instructor (as provider): reply.
  providerScript: {
    situations: [
      { id: 's-chest-pain', title: 'Chest pain', text: 'Dull, aching chest pain 8/10 radiating to the left arm, diaphoretic, short of breath. History of CAD and hypertension.' },
      { id: 's-ntg-unrelieved', title: 'Chest pain unrelieved by nitroglycerin', text: 'Sublingual nitroglycerin given x3 over 15 minutes with no relief; 12-lead obtained.' },
      { id: 's-hypotension', afterEvent: 'ev-hypotension', title: 'Hypotension', text: 'Systolic blood pressure below 100 after nitroglycerin; patient light-headed. Nitroglycerin held.' },
      { id: 's-labs', afterEvent: 'ev-labs', title: 'Critical lab results', text: 'Troponin I 1.00 ng/dL (expected below 0.04). Potassium 2.2 mEq/L.' },
      { id: 's-rhythm', afterEvent: 'ev-ecg-2', title: 'Rhythm change', text: 'Monitor shows supraventricular tachycardia with a run of ventricular tachycardia; 12-lead obtained.' },
      { id: 's-spo2', title: 'Low oxygen saturation', text: 'SpO2 below 90% with increased work of breathing; oxygen applied per standing orders.' },
      { id: 's-refusal', title: 'Patient refusing medication', text: 'Patient declines an ordered medication after education.' },
      { id: 's-update', afterEvent: 'ev-improving', title: 'Status update', text: 'Patient improving: chest pain 2/10, easier breathing, vitals trending toward baseline.' }
    ],
    recommendations: [
      { id: 'r-evaluate', title: 'Request bedside evaluation now' },
      { id: 'r-orders', title: 'Request new orders', text: 'for example analgesia, heparin protocol, potassium replacement' },
      { id: 'r-bolus', title: 'Request fluid bolus order' },
      { id: 'r-ecg', title: 'Request repeat 12-lead and labs' },
      { id: 'r-transfer', title: 'Request higher level of care or rapid response' },
      { id: 'r-fyi', title: 'For your information; will continue to monitor' }
    ],
    replies: [
      { id: 'p-morphine', title: 'Give morphine 2 mg IV push once; repeat 12-lead', text: 'Call back if pain persists.', activateMeds: ['morphine'], orders: [{ category: 'Medications', text: 'Morphine 2 mg IV push once for chest pain unrelieved by nitroglycerin' }, { category: 'Diagnostics', text: 'Repeat 12-lead ECG now' }] },
      { id: 'p-heparin', title: 'Start heparin per protocol; potassium chloride 20 mEq PO', text: 'PTT q6h. Hold low-molecular-weight heparin.', activateMeds: ['heparin-gtt'], orders: [{ category: 'Medications', text: 'Heparin per weight-based protocol: loading dose IVP then continuous infusion' }, { category: 'Labs', text: 'aPTT every 6 hours while on heparin' }, { category: 'Medications', text: 'Potassium chloride 20 mEq PO now for K 2.2' }] },
      { id: 'p-bolus', title: 'Normal saline 500 mL bolus; hold nitroglycerin', text: 'Repeat bolus x1 if SBP still below 100, then call back.', orders: [{ category: 'Medications', text: 'Normal saline 500 mL IV bolus now; may repeat x1 for SBP below 100' }, { category: 'Nursing', text: 'Hold nitroglycerin while SBP below 100; notify provider after bolus' }] },
      { id: 'p-oxygen', title: 'Titrate oxygen to SpO2 90-96%; chest X-ray', text: 'Elevate head of bed.', orders: [{ category: 'Diagnostics', text: 'Portable chest X-ray now' }, { category: 'Nursing', text: 'Head of bed elevated; titrate oxygen to SpO2 90-96%' }] },
      { id: 'p-rapid', title: 'Call rapid response; I am on my way', text: 'Prepare for transfer to ICU.', orders: [{ category: 'Nursing', text: 'Rapid response called; prepare for transfer to ICU' }] },
      { id: 'p-monitor', title: 'Continue to monitor; call back with any change', text: '' },
      { id: 'p-document', title: 'Document the refusal; I will speak with the patient', text: '' }
    ]
  },
  // Worklist tasks (the "Brain"). trigger: { atMinutes } from session start, { afterMedGiven: medId, minutes }, or { afterEvent: eventId, minutes }.
  tasks: [
    { id: 't-identify', title: 'Introduce yourself; verify two patient identifiers and allergy band', category: 'Safety', trigger: { atMinutes: 0 } },
    { id: 't-monitor', title: 'Apply cardiac monitor and continuous SpO2', category: 'Monitoring', trigger: { atMinutes: 0 } },
    { id: 't-ecg-1', title: 'Obtain 12-lead ECG (standing order)', category: 'Diagnostics', trigger: { atMinutes: 0 } },
    { id: 't-safety', title: 'Bed low, call light in reach, fall precautions', category: 'Safety', trigger: { atMinutes: 0 } },
    { id: 't-focused', title: 'Focused assessment: neuro, cardiac, respiratory, pain', category: 'Assessment', trigger: { atMinutes: 5 } },
    { id: 't-o2', title: 'Apply and titrate oxygen for SpO2 below 90% (target 90-96%)', category: 'Intervention', trigger: { afterEvent: 'ev-chest-pain', minutes: 0 } },
    { id: 't-ecg-cp', title: 'Obtain 12-lead ECG for new chest pain', category: 'Diagnostics', trigger: { afterEvent: 'ev-chest-pain', minutes: 0 } },
    { id: 't-reassess-ntg', title: 'Reassess chest pain and blood pressure 5 minutes after nitroglycerin', category: 'Reassessment', trigger: { afterMedGiven: 'ntg-sl', minutes: 5 } },
    { id: 't-notify-cp', title: 'Notify provider if chest pain is unrelieved after 3 nitroglycerin doses', category: 'Communication', trigger: { afterEvent: 'ev-chest-pain', minutes: 15 } },
    { id: 't-bolus-recheck', title: 'Recheck blood pressure after saline bolus', category: 'Reassessment', trigger: { afterMedGiven: 'ns-bolus', minutes: 10 } },
    { id: 't-k', title: 'Review potassium 2.2 and replace per PRN order; cardiac monitoring', category: 'Intervention', trigger: { afterEvent: 'ev-labs', minutes: 0 } },
    { id: 't-trop-3h', title: 'Repeat troponin I at 3 hours', category: 'Labs', trigger: { atMinutes: 180 } },
    { id: 't-ptt', title: 'Draw aPTT 6 hours after heparin infusion starts', category: 'Labs', trigger: { afterMedGiven: 'heparin-gtt', minutes: 360 } }
  ],
  // Patient voice: scripted patient brain for verbal assessment. The student speaks; the Pi matches the question to an
  // intent by keywords and answers in the patient's voice for the current phase (baseline, chestpain, hypotension, rhythm, improving).
  // Each intent names the cues it reveals (for the clinical-judgement log). An AI model can replace matching later behind the same endpoint.
  patientVoice: {
    persona: 'Carl Shapiro, 54, businessman, anxious but cooperative, understates symptoms until pressed, worried about missing work.',
    phases: { 'ev-chest-pain': 'chestpain', 'ev-hypotension': 'hypotension', 'ev-ecg-2': 'rhythm', 'ev-improving': 'improving' },
    unknown: ["I'm sorry, nurse, say that again?", "I'm not sure what you're asking.", 'Can you ask me that a different way?'],
    intents: [
      { id: 'identify', keywords: ['your name', 'name', 'date of birth', 'birthday', 'born', 'who are you'], cues: ['identity'], reply: { default: "Carl Shapiro. April fifteenth, nineteen sixty-nine." } },
      { id: 'greeting', keywords: ['hello', 'hi ', 'good morning', 'good afternoon', 'how are you', 'how do you feel', 'how are you feeling', 'feeling'], cues: ['general appearance'], reply: { default: "Honestly? Not great. This chest thing has me rattled.", chestpain: "Not good. It's back and it's worse. I'm sweating and I can't catch my breath.", hypotension: "Woozy. The room spun when I sat up.", rhythm: "My heart is racing. Something's not right.", improving: "Better, actually. The pain is almost gone and I can breathe." } },
      { id: 'chief', keywords: ['what brought', 'why are you here', 'what happened', 'what is going on', "what's going on", 'tell me about', 'chest'], cues: ['chief complaint'], reply: { default: "I've had this dull, aching pressure in my chest on and off for a couple of days. Today it wouldn't quit, and I got short of breath, so I came in.", chestpain: "It's the chest pain again, right now, worse than before. Squeezing. It's going into my left arm.", improving: "The chest pain. It's mostly gone now." } },
      { id: 'pain-scale', keywords: ['scale', 'zero to ten', '0 to 10', 'out of ten', 'how bad', 'rate your pain', 'how much pain', 'pain level'], cues: ['pain score'], reply: { default: 'Maybe a four. A dull ache.', chestpain: "An eight. It's bad.", hypotension: 'Still about a six.', rhythm: 'A seven, and my heart is pounding.', improving: 'A two. Much better.' } },
      { id: 'pain-location', keywords: ['where', 'point to', 'location', 'radiate', 'spread', 'arm', 'jaw', 'back'], cues: ['pain location and radiation'], reply: { default: "Right here in the middle of my chest. It doesn't really go anywhere.", chestpain: 'Center of my chest, and it goes down my left arm. My jaw feels tight too.', improving: 'Just a little in the middle of my chest now.' } },
      { id: 'pain-quality', keywords: ['describe', 'what does it feel', 'feel like', 'sharp', 'dull', 'pressure', 'squeez', 'crushing', 'burning', 'quality'], cues: ['pain quality'], reply: { default: 'Dull. Like a heavy pressure, like someone is sitting on my chest.', chestpain: "Squeezing. Like a band tightening around my chest.", improving: 'A dull ache, fading.' } },
      { id: 'pain-onset', keywords: ['when did', 'start', 'how long', 'onset', 'begin', 'since when'], cues: ['onset and duration'], reply: { default: "It started a couple of days ago, on and off. This morning it lasted about an hour and didn't let up.", chestpain: 'A few minutes ago. It came on fast this time.' } },
      { id: 'pain-better-worse', keywords: ['better', 'worse', 'relieve', 'rest', 'exertion', 'walking', 'activity', 'make it'], cues: ['aggravating and relieving factors'], reply: { default: "Resting usually helps. Walking fast or stairs brings it on. Stress too.", chestpain: "Nothing is helping right now. Even sitting still it's there." } },
      { id: 'breathing', keywords: ['breath', 'breathing', 'short of breath', 'dyspnea', 'oxygen', 'air'], cues: ['dyspnea'], reply: { default: "A little short of breath, mostly when the pain comes.", chestpain: "Yes, I can't get a full breath.", hypotension: "Breathing is okay, I'm just dizzy.", improving: 'Breathing is fine now.' } },
      { id: 'dizzy', keywords: ['dizzy', 'lightheaded', 'light headed', 'faint', 'woozy', 'spin'], cues: ['dizziness'], reply: { default: 'No, not dizzy.', hypotension: 'Yes, very. When I sat up the room spun and I thought I might pass out.', rhythm: 'A little, and my heart is racing.' } },
      { id: 'nausea', keywords: ['nausea', 'nauseous', 'sick to your stomach', 'vomit', 'throw up', 'stomach'], cues: ['nausea'], reply: { default: 'A little queasy, now that you mention it.', chestpain: "Yes, I feel sick to my stomach and I'm sweating." } },
      { id: 'sweating', keywords: ['sweat', 'diaphore', 'clammy'], cues: ['diaphoresis'], reply: { default: 'I was sweating earlier when the pain was bad.', chestpain: "Yes, look at me, I'm drenched." } },
      { id: 'palpitations', keywords: ['heart racing', 'palpitation', 'pounding', 'skip', 'flutter', 'heartbeat'], cues: ['palpitations'], reply: { default: 'No, not really.', rhythm: "Yes! It's pounding and fluttering. I can feel it in my throat." } },
      { id: 'history', keywords: ['history', 'medical problems', 'conditions', 'diagnosed', 'heart problems', 'blood pressure', 'hypertension', 'anxiety', 'past'], cues: ['past medical history'], reply: { default: "High blood pressure for years. They told me I have some blockage in my heart arteries. And I get anxious, especially with work." } },
      { id: 'medications', keywords: ['medication', 'medicine', 'pills', 'take', 'prescri', 'water pill', 'diuretic'], cues: ['home medications'], reply: { default: "Just a water pill for my blood pressure. I don't remember the name. I miss doses when I travel." } },
      { id: 'sildenafil', keywords: ['viagra', 'sildenafil', 'cialis', 'tadalafil', 'erectile', 'ed medication', 'sexual', 'performance'], cues: ['PDE5 inhibitor use (nitroglycerin contraindication)'], reply: { default: "Uh... yes. I took a Viagra last night, around nine. Is that a problem?" } },
      { id: 'allergies', keywords: ['allerg', 'reaction', 'peanut'], cues: ['allergies'], reply: { default: "Peanuts. My throat swells. Nothing else that I know of." } },
      { id: 'smoking', keywords: ['smok', 'cigarette', 'tobacco', 'vape'], cues: ['tobacco use'], reply: { default: "Less than half a pack a day. I know, I know. I've been trying to quit." } },
      { id: 'alcohol', keywords: ['alcohol', 'drink', 'beer', 'wine', 'liquor'], cues: ['alcohol use'], reply: { default: 'A drink or two with clients, a few times a week. Nothing heavy.' } },
      { id: 'drugs', keywords: ['cocaine', 'drugs', 'recreational', 'stimulant'], cues: ['substance use'], reply: { default: "No. Never." } },
      { id: 'stress', keywords: ['stress', 'work', 'job', 'travel', 'pressure at'], cues: ['psychosocial stressors'], reply: { default: "Work is brutal. I travel every week. I've been pushing myself, and honestly the stress is getting to me." } },
      { id: 'family', keywords: ['family', 'wife', 'spouse', 'someone we can call', 'support', 'emergency contact', 'anyone with you'], cues: ['support system'], reply: { default: "No family here. I'm in town on business. My sister is in Denver; I'd rather not worry her yet." } },
      { id: 'family-history', keywords: ['father', 'mother', 'parents', 'family history', 'run in'], cues: ['family history'], reply: { default: 'My dad had a heart attack at sixty. My mother has high blood pressure.' } },
      { id: 'eaten', keywords: ['eat', 'eaten', 'food', 'meal', 'last ate', 'drank', 'nothing by mouth'], cues: ['last oral intake'], reply: { default: 'Coffee and a bagel around seven this morning. Nothing since.' } },
      { id: 'urine', keywords: ['urinat', 'pee', 'bathroom', 'bladder', 'void'], cues: ['elimination'], reply: { default: "I went about an hour ago, normal." } },
      { id: 'code-status', keywords: ['code status', 'resuscitat', 'advance directive', 'living will', 'if your heart stopped'], cues: ['code status'], reply: { default: "Do everything. I'm fifty-four, I'm not done yet." } },
      { id: 'understanding', keywords: ['understand', 'what do you think', 'explain', 'worried', 'scared', 'afraid', 'questions'], cues: ['patient understanding and anxiety'], reply: { default: "I think it's stress. But my dad had a heart attack, so... yeah, I'm scared.", improving: "I think I get it now. The medicine helped. I'd like to know what happens next." } },
      { id: 'consent', keywords: ['okay if i', 'may i', 'can i', 'going to', 'i am going to', "i'm going to", 'permission'], cues: ['consent and cooperation'], reply: { default: 'Sure, go ahead.', hypotension: 'Okay, but slowly, I feel faint.' } },
      { id: 'nitro-effect', keywords: ['did that help', 'after the nitro', 'nitroglycerin help', 'tablet help', 'any relief'], cues: ['response to intervention'], reply: { default: "A little. It's maybe a six now. My head is pounding though.", hypotension: "The pain is a bit better but now I'm dizzy.", improving: 'Yes, that helped a lot.' } }
    ]
  },
  // Objective assessment. When the student verbalizes an exam ("let me listen to your lungs"), the room display shows
  // the finding for the current phase and plays the sound where one applies; the patient still responds in character.
  exam: [
    { id: 'lungs', system: 'resp', keywords: ['listen to your lungs', 'listen to your chest', 'lung sounds', 'breath sounds', 'deep breath', 'breathe in', 'breathe for me', 'auscultate your lungs', 'listen to your back'], label: 'Lung sounds', sound: 'breath', patient: { default: 'Okay. (breathes in and out)', chestpain: "(short, shallow breaths) I can't take a deep one.", improving: 'Sure. (breathes deeply)' }, finding: { default: 'Clear bilaterally, slightly diminished at the bases; respirations even, unlabored.', chestpain: 'Clear bilaterally; respirations rapid and shallow, mild accessory muscle use.', hypotension: 'Fine crackles at both bases; respirations rapid.', rhythm: 'Clear; respirations rapid.', improving: 'Clear bilaterally; respirations even and unlabored.' } },
    { id: 'heart', system: 'cardiac', keywords: ['listen to your heart', 'heart sounds', 'auscultate your heart', 'apical', 'listen to your chest for a minute'], label: 'Heart sounds', sound: 'heart', patient: { default: 'Go ahead.' }, finding: { default: 'S1 S2, regular rate and rhythm, mildly tachycardic; no murmur.', chestpain: 'S1 S2 regular, tachycardic, occasional premature beats.', hypotension: 'S1 S2, tachycardic, regular.', rhythm: 'Rapid, regular rate then a run of irregular wide beats; S1 S2 difficult to distinguish.', improving: 'S1 S2, regular rate and rhythm.' } },
    { id: 'pulses', system: 'cardiac', keywords: ['check your pulse', 'feel your pulse', 'radial', 'pedal pulse', 'pulses', 'check your feet', 'dorsalis'], label: 'Peripheral pulses', sound: null, patient: { default: 'Okay.' }, finding: { default: 'Radial 2+ bilaterally, regular; pedal pulses 2+ bilaterally.', chestpain: 'Radial 2+ bilaterally, rapid; pedal 2+.', hypotension: 'Radial 1+ bilaterally, thready, rapid; pedal 1+.', rhythm: 'Radial rapid and irregular, 1+ to 2+.', improving: 'Radial 2+ regular; pedal 2+.' } },
    { id: 'cap-refill', system: 'cardiac', keywords: ['capillary refill', 'cap refill', 'press on your nail', 'squeeze your finger', 'fingernail'], label: 'Capillary refill', sound: null, patient: { default: 'Sure.' }, finding: { default: 'Less than 2 seconds.', hypotension: 'About 3 seconds; hands cool.', improving: 'Less than 2 seconds.' } },
    { id: 'skin', system: 'skin', keywords: ['look at your skin', 'your color', 'feel your skin', 'skin', 'sweaty', 'temperature of your'], label: 'Skin', sound: null, patient: { default: 'Hm?' }, finding: { default: 'Warm, dry, pale pink; no cyanosis.', chestpain: 'Cool, diaphoretic, pale.', hypotension: 'Cool, clammy, pale.', rhythm: 'Cool, diaphoretic.', improving: 'Warm, dry, pink.' } },
    { id: 'edema', system: 'cardiac', keywords: ['swelling', 'edema', 'press on your leg', 'press on your shin', 'ankles'], label: 'Peripheral edema', sound: null, patient: { default: 'My ankles do get puffy at the end of a travel day.' }, finding: { default: 'Trace bilateral ankle edema; no pitting above the ankle.' } },
    { id: 'neuro', system: 'neuro', keywords: ['squeeze my hands', 'squeeze my fingers', 'push against', 'pull against', 'grip', 'where are you', 'what day is it', 'what is today', 'do you know where', 'orient', 'month is it', 'year is it', 'who is the president'], label: 'Neurological', sound: null, patient: { default: "University General, it's Tuesday, I think, and you're the nurse. (squeezes) Like that?", hypotension: "The hospital... give me a second, I'm foggy. (weak squeeze)", rhythm: "The hospital. Why? Is something wrong?" }, finding: { default: 'Alert and oriented x4; grips equal and strong; speech clear.', chestpain: 'Alert and oriented x4; anxious; grips equal and strong.', hypotension: 'Alert, oriented x3, slow to answer; grips equal, weaker; speech clear.', rhythm: 'Alert and oriented x4, anxious; grips equal.', improving: 'Alert and oriented x4; grips equal and strong.' } },
    { id: 'pupils', system: 'neuro', keywords: ['pupils', 'shine a light', 'look at my finger', 'follow my finger', 'penlight', 'eyes'], label: 'Pupils', sound: null, patient: { default: 'Okay. (looks up)' }, finding: { default: 'PERRL, 3 mm, brisk; extraocular movements intact.', hypotension: 'PERRL, 3 mm; slightly slow to track.' } },
    { id: 'abdomen', system: 'gi', keywords: ['listen to your belly', 'listen to your abdomen', 'press on your belly', 'press on your stomach', 'abdomen', 'bowel sounds', 'tender'], label: 'Abdomen', sound: 'bowel', patient: { default: "Go ahead. I'm a little queasy, so easy.", chestpain: "(winces) It's my chest, not my stomach." }, finding: { default: 'Soft, non-tender, non-distended; bowel sounds active in all four quadrants.' } },
    { id: 'chest-wall', system: 'cardiac', keywords: ['press on your chest', 'push on your chest', 'does this hurt', 'reproduce', 'chest wall', 'tender to touch'], label: 'Chest wall', sound: null, patient: { default: "No, pressing doesn't change it. It's inside.", chestpain: "No, that doesn't make it worse. It's deep, like it's being squeezed." }, finding: { default: 'Chest wall non-tender; pain not reproducible with palpation.' } },
    { id: 'iv-site', system: 'skin', keywords: ['iv site', 'look at your iv', 'check your iv', 'your arm where the', 'drip'], label: 'IV site', sound: null, patient: { default: "It's fine, a little sore." }, finding: { default: 'Left forearm 20 g, patent, dressing clean, dry and intact; no redness or swelling; Lactated Ringers infusing at 25 mL/h.' } },
    { id: 'respiratory-effort', system: 'resp', keywords: ['watch you breathe', 'count your breaths', 'breathing rate', 'work of breathing', 'cough for me'], label: 'Respiratory effort', sound: 'breath', patient: { default: '(breathes normally)', chestpain: '(breathing fast) I feel like I cannot catch my breath.' }, finding: { default: 'Even, unlabored, symmetric chest rise; no accessory muscle use.', chestpain: 'Rapid, shallow; mild accessory muscle use; speaks in short phrases.', hypotension: 'Rapid; speaks in full sentences.', improving: 'Even and unlabored.' } },
    { id: 'pain-assess', system: 'pain', keywords: ['pqrst', 'oldcart', 'tell me about your pain', 'assess your pain'], label: 'Pain assessment', sound: null, patient: { default: 'Dull ache, middle of my chest, about a four. Rest helps.', chestpain: 'Squeezing, center of my chest into my left arm, an eight, started a few minutes ago, nothing helps.', improving: 'A two now, just a dull ache.' }, finding: { default: 'Patient reports pain as described; grimacing absent at rest.', chestpain: 'Patient clutching chest, grimacing, diaphoretic.', improving: 'Relaxed, no grimacing.' } }
  ],
  // Priority systems from the packet: neuro (perfusion/LOC), cardiac (angina), respiratory.
  priorityAssessments: ['neuro', 'cardiac', 'resp', 'pain'],
  // eMAR. kind: scheduled (due at dueMinutes after session start), prn, stat, assignable (sim-day meds the instructor activates at setup).
  // barcode values are printed on the labels page; holdRule is checked against the live monitor at administration and flagged, not blocked.
  medications: [
    { id: 'lr', name: 'Lactated Ringers 1,000 mL', dose: '25 mL/hour', route: 'IV continuous', frequency: 'Continuous', kind: 'scheduled', dueMinutes: 0, once: true, barcode: 'MED-LR1000' },
    { id: 'asa', name: 'Aspirin', dose: '325 mg', route: 'PO, chewed', frequency: 'Once', kind: 'scheduled', dueMinutes: 0, once: true, barcode: 'MED-ASA325' },
    { id: 'metoprolol', name: 'Metoprolol', dose: '25 mg', route: 'PO', frequency: 'BID', kind: 'scheduled', dueMinutes: 0, intervalMin: 720, barcode: 'MED-METO25' },
    { id: 'ntg-td', name: 'Nitroglycerin transdermal', dose: '1 inch', route: 'Topical', frequency: 'BID', kind: 'scheduled', dueMinutes: 0, intervalMin: 720, barcode: 'MED-NTGTD1', holdRule: { sbpBelow: 100 } },
    { id: 'ntg-sl', name: 'Nitroglycerin', dose: '0.4 mg', route: 'Sublingual', frequency: 'q5 min PRN chest pain, max 3 doses in 15 min', kind: 'prn', prn: { minIntervalMin: 5, maxDoses: 3, windowMin: 15, indication: 'chest pain' }, barcode: 'MED-NTGSL04', holdRule: { sbpBelow: 100 } },
    { id: 'paroxetine', name: 'Paroxetine hydrochloride', dose: '10 mg', route: 'PO', frequency: 'Q6H PRN anxiety', kind: 'prn', prn: { minIntervalMin: 360, indication: 'anxiety' }, barcode: 'MED-PARO10' },
    { id: 'hydralazine', name: 'Hydralazine hydrochloride', dose: '10 mg', route: 'IV push', frequency: 'Q8H PRN systolic BP >160', kind: 'prn', prn: { minIntervalMin: 480, indication: 'systolic BP above 160' }, barcode: 'MED-HYDR10' },
    { id: 'albumin', name: 'Albumin 25%', dose: '25 g/100 mL', route: 'IV', frequency: 'Q8H PRN SBP <80', kind: 'prn', prn: { minIntervalMin: 480, indication: 'SBP below 80' }, barcode: 'MED-ALB25' },
    { id: 'kcl-po', name: 'Potassium chloride', dose: '20 mEq', route: 'PO', frequency: 'BID PRN K <3.5', kind: 'prn', prn: { minIntervalMin: 720, indication: 'K below 3.5' }, barcode: 'MED-KCL20' },
    { id: 'kcl-iv', name: 'Potassium chloride in 0.9% NaCl', dose: 'per order', route: 'IVPB', frequency: 'PRN K <3', kind: 'prn', barcode: 'MED-KCLIV' },
    { id: 'ns-bolus', name: 'Normal saline bolus', dose: '500 mL', route: 'IV', frequency: 'STAT; may repeat x1 for SBP <100, notify provider', kind: 'stat', prn: { maxDoses: 2, windowMin: 1440, indication: 'SBP below 100' }, barcode: 'MED-NS500' },
    { id: 'heparin-sq', name: 'Heparin', dose: '5,000 units', route: 'Subcutaneous', frequency: 'Per order', kind: 'assignable', barcode: 'MED-HEPSQ5K' },
    { id: 'heparin-gtt', name: 'Heparin infusion', dose: 'per protocol, weight-based', route: 'IV continuous', frequency: 'Continuous; per protocol, PTT q6h', kind: 'assignable', barcode: 'MED-HEPGTT' },
    { id: 'morphine', name: 'Morphine', dose: '2 mg', route: 'IV push', frequency: 'Once for chest pain unrelieved by NTG', kind: 'assignable', once: true, barcode: 'MED-MORPH' }
  ],
  ordersMeta: { placedBy: 'ED attending (standing orders)', placedAt: 'On admission' },
  orders: [
    { title: 'Chest pain standing orders', category: 'Nursing', items: ['12-lead ECG', 'Cardiac monitoring', 'Continuous SpO₂ monitoring', 'Apply and titrate oxygen for SpO₂ less than 90% or respiratory distress; SpO₂ target range 90–96%', 'Troponin I now and repeat in 3 hours and 6 hours', 'BMP, CBC, platelets, PTT, PT/INR, BNP', 'Chest X-ray', '12-lead ECG for new or worsening chest pain'] },
    { title: 'Medication orders', category: 'Medications', items: ['Lactated Ringers 1,000 mL at 25 mL/hour continuous IV', 'Aspirin 325 mg PO (chewed)', 'Metoprolol 25 mg PO BID', 'Paroxetine hydrochloride 10 mg PO Q6H PRN for anxiety', 'Hydralazine hydrochloride 10 mg IVP Q8H PRN for systolic BP >160', 'Nitroglycerin 1-inch transdermal BID', 'Nitroglycerin 0.4 mg sublingual every 5 minutes PRN for chest pain, up to 3 doses within 15 minutes', 'If chest pain is not relieved by sublingual nitroglycerin ×3, notify provider immediately and obtain 12-lead ECG', 'Hold nitroglycerin for systolic blood pressure less than 100 mmHg', 'Albumin 25% 25 g/100 mL IV Q8H PRN for SBP <80', 'Potassium chloride 20 mEq PO BID PRN for K <3.5', 'Potassium chloride in 0.9% NaCl IVPB for K <3'] },
    { title: 'STAT orders', category: 'Medications', items: ['Normal saline 500 mL bolus; may repeat ×1 for systolic blood pressure less than 100 mmHg and notify provider'] },
    { title: 'Heparin protocol', category: 'Protocols', items: ['Notify physician if 2 consecutive aPTTs are greater than 200 seconds', 'Notify physician for any abnormal PT/INR, aPTT, or platelets; acute bleeding or persistent oozing from IV sites; decrease in systolic blood pressure by 50 mmHg or SBP less than 100; or changes in neurological status', 'Contact physician for clarification if both low-molecular-weight heparin and heparin are ordered', 'Do NOT give any low-molecular-weight heparin (e.g., enoxaparin, dalteparin) while on heparin', 'Call provider with any change in patient status'] }
  ],
  facilitator: {
    setup: ['Lay out: male parts, Alaris pump, IV tubing ×4', 'Orders to prepare: 1 L LR for maintenance; 500 mL NS for bolus ×2; aspirin 325 mg; heparin 5,000 U SQ; heparin gtt; heparin 1,000 U/mL; metoprolol 25 mg PO; nitroglycerin 0.4 mg SL; hydralazine hydrochloride 10 mg IVP; nitroglycerin 1-inch transdermal; morphine; paroxetine hydrochloride'],
    briefing: [
      ['Heparin loading dose', 'IVP given prior to heparin gtt. Initial gtt rate is based on weight, then adjusted to meet therapeutic range 70–95 sec. Dosage calc: what you want × what you have (100 U × mL / 1,000 U). Go over Code Blues in Hospital Setting PPT.'],
      ['What can kill the patient?', 'Full arrest.'],
      ['Priority assessments', 'Neuro (impaired circulation = less O₂ to brain, which can alter LOC / mentation). Cardiac (patient came in with angina). Respiratory (cardiac and respiratory conditions affect each other).'],
      ['Contraindications to nitroglycerin?', 'Yes: sildenafil (Viagra), which can greatly drop BP. Consider how students will ask the patient whether he is taking it and what it is used for.'],
      ['Shortness of breath interventions', 'Elevate HOB so patient is sitting up (allows diaphragm to fully expand, relieves pressure from gravity). Tripod breathing: position side table over bed so patient can lean on it.']
    ],
    reveals: [
      { title: 'Results to release during the SIM', items: ['12-lead, 1st time: sinus tachycardia with occasional PVCs', '12-lead, 2nd time: supraventricular tachycardia with a 10-beat run of V-tach', 'Troponin I: 1.00 ng/dL (expected <0.04 ng/mL)', 'Potassium: 2.2', 'PT 12.5 (11–12.5 sec) · INR 1.0 (0.8–1.1) · aPTT 32 (30–40 sec) · PLT 220 (150–400 mm³)'] },
      { title: 'Hypotension (SBP <90)', items: ['500 mL bolus 0.9% normal saline ×2', 'Albumin 5% 250–500 mL IV ×1 for SBP <100 if patient has crackles'] },
      { title: 'Elevated troponin — heparin titration', items: ['Baseline PTT 30. Heparin loading dose 10,000 units IVP. Initial drip rate 15 units/kg. Therapeutic range 70–95 sec.', 'PTT >146: HOLD infusion, draw PTT in 2 h, recontact pharmacist for new rate', 'PTT 126–145: HOLD infusion 2 h, then decrease gtt by 200 units/h', 'PTT 96–125: HOLD infusion 1 h, then decrease gtt by 100 units/h', 'PTT 70–95: no change (therapeutic)', 'PTT 55–69: bolus 1,000 units IVP, then increase gtt by 100 units/h', 'PTT <55: bolus 2,000 units IVP, then increase gtt by 200 units/h'] }
    ],
    groups: [
      { group: 1, focus: 'Hypertension — hydralazine', meds: ['Metoprolol 25 mg', 'LR 1,000 mL at 25 mL/h', 'Nitroglycerin 1-inch transdermal', 'Aspirin 325 mg chew'] },
      { group: 2, focus: 'Hypotension — 500 mL bolus', meds: ['Metoprolol 25 mg', 'Nitroglycerin 1-inch transdermal', 'Aspirin 325 mg chew', 'Heparin 5,000 U SQ'] },
      { group: 3, focus: 'Recommend: heparin gtt', meds: ['Metoprolol 25 mg', 'Nitroglycerin 1-inch transdermal', 'Aspirin 325 mg chew', 'Heparin 5,000 U SQ'] },
      { group: 4, focus: 'Titrate heparin gtt; verbalize order for PTT q6h', meds: ['Metoprolol 25 mg', 'Nitroglycerin 1-inch transdermal', 'Start heparin gtt'] },
      { group: 5, focus: 'Titrate heparin gtt', meds: ['Metoprolol 25 mg', 'Nitroglycerin 1-inch transdermal', 'Aspirin 325 mg chew', 'Heparin 5,000 U SQ'] }
    ],
    monitorPresets: [
      { name: 'Baseline', values: { hr: 104, rr: 20, spo2: 94, sbp: 148, dbp: 88, temp: 37.0, rhythm: 'sinus_tach_pvc' } },
      { name: 'Chest pain episode', values: { hr: 112, rr: 24, spo2: 92, sbp: 168, dbp: 96, temp: 37.1, rhythm: 'sinus_tach_pvc' } },
      { name: 'Hypotension (SBP <90)', values: { hr: 118, rr: 24, spo2: 93, sbp: 86, dbp: 52, temp: 37.0, rhythm: 'sinus_tach' } },
      { name: 'SVT', values: { hr: 160, rr: 26, spo2: 91, sbp: 98, dbp: 60, temp: 37.0, rhythm: 'svt' } },
      { name: 'V-tach run', values: { hr: 170, rr: 28, spo2: 88, sbp: 78, dbp: 40, temp: 37.0, rhythm: 'vtach' } },
      { name: 'Improving', values: { hr: 84, rr: 18, spo2: 97, sbp: 128, dbp: 78, temp: 37.0, rhythm: 'nsr' } }
    ],
    checklist: ['Hand hygiene', 'Board', 'Outcome', 'Vitals', 'EKG', '2 identifiers', 'DOB', 'Allergies', 'Meds', 'Med documentation', 'Cardiac / Respiratory / Neuro']
  }
};
export const studentView = ({ facilitator, ...rest }) => rest;
