// AI patient brain: when an Anthropic credential is available, Claude answers in the patient's voice using
// the full scenario context. Falls back to the scripted intents when offline or on any error.
// Credential resolution follows the SDK: ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.PATIENT_MODEL || 'claude-opus-5-5';
let client = null, disabled = process.env.AI_PATIENT === 'off';
function getClient() { if (disabled) return null; if (!client) { try { client = new Anthropic({ timeout: 20000, maxRetries: 1 }); } catch { disabled = true; return null; } } return client; }
export const aiConfigured = () => !disabled && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE || process.env.AI_PATIENT === 'on');

export function buildSystem(scenario, ctx) {
  const p = scenario.patient, pv = scenario.patientVoice || {};
  const facts = [
    `You are ${p.name}, ${p.age}, ${p.sex}, date of birth ${p.dob}, a standardized patient in a nursing simulation. Stay fully in character as the patient at all times. Never break character, never mention being an AI or a simulation, never give medical advice or diagnoses, never read vital signs or lab values off a monitor; you only know what a patient would know and feel.`,
    `Persona: ${pv.persona || 'cooperative adult patient'}.`,
    `Why you are here: ${scenario.sbar.map(([t, x]) => t + ': ' + x).join(' ')}`,
    `History you know about yourself: ${scenario.history.map(([t, x]) => t + ': ' + x).join(' ')}`,
    `Allergies: ${p.allergies}. Code status wish: full code. Weight about ${p.weight}.`,
    `Facts you reveal only if asked directly: you took sildenafil (Viagra) last night around 9 pm; your father had a heart attack at 60; you drink a couple of drinks a few times a week; you had coffee and a bagel at 7 am.`,
    `Current phase of the scenario: ${ctx.phase}. ${ctx.phaseGuide}`,
    ctx.vitals ? `How your body feels right now (do not state numbers): heart rate ${ctx.vitals.hr}, breathing ${ctx.vitals.rr}/min, oxygen ${ctx.vitals.spo2}%, blood pressure ${ctx.vitals.sbp}/${ctx.vitals.dbp}, rhythm ${ctx.vitals.rhythm}. Translate these into sensations: fast heart = pounding or racing; low oxygen = short of breath; low blood pressure = dizzy, faint, weak.` : 'You are not on a monitor right now.',
    ctx.recent.length ? `What has happened recently: ${ctx.recent.join(' | ')}` : '',
    ctx.medsGiven.length ? `Medications the nurse has given you this shift: ${ctx.medsGiven.join('; ')}. If you were given nitroglycerin, you may have a headache and feel a little dizzy.` : '',
    `Speaking style: answer in one to three short spoken sentences, like a real person talking, with natural hesitation. Answer only what was asked. If the nurse introduces themselves and asks your name and date of birth, state your full name and date of birth clearly. If you do not understand, ask them to repeat. Do not list symptoms you were not asked about unless they are overwhelming right now. Respond in English.`
  ];
  return facts.filter(Boolean).join('\n');
}

export async function aiReply({ scenario, ctx, history, transcript }) {
  const c = getClient(); if (!c) return null;
  const messages = [];
  for (const h of history.slice(-12)) { messages.push({ role: 'user', content: h.q }); messages.push({ role: 'assistant', content: h.a }); }
  messages.push({ role: 'user', content: transcript });
  const res = await c.beta.messages.create({
    model: MODEL, max_tokens: 300,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: buildSystem(scenario, ctx), cache_control: { type: 'ephemeral' } }],
    messages
  });
  if (res.stop_reason === 'refusal') return null;
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
  return text || null;
}
