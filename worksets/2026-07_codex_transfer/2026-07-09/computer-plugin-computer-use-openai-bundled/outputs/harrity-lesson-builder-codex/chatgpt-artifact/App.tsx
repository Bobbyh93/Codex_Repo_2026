import React, { useMemo, useState } from "react";

const TTS_MODELS = ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"] as const;
const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;
const AUDIO_FORMATS = ["mp3", "wav", "aac", "flac", "opus", "pcm"] as const;

type TtsModel = (typeof TTS_MODELS)[number];
type Voice = (typeof VOICES)[number];
type AudioFormat = (typeof AUDIO_FORMATS)[number];

type FormState = {
  lessonTitle: string;
  slideId: string;
  audioModel: TtsModel;
  voice: Voice;
  responseFormat: AudioFormat;
  scriptText: string;
};

type TestResult = {
  name: string;
  pass: boolean;
  detail: string;
};

const DEFAULT_FORM: FormState = {
  lessonTitle: "",
  slideId: "S001",
  audioModel: "gpt-4o-mini-tts",
  voice: "alloy",
  responseFormat: "mp3",
  scriptText: "",
};

function isSupportedValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

function runSelfTests(form: FormState): TestResult[] {
  return [
    {
      name: "default model is supported",
      pass: isSupportedValue(TTS_MODELS, DEFAULT_FORM.audioModel),
      detail: DEFAULT_FORM.audioModel,
    },
    {
      name: "selected model is supported",
      pass: isSupportedValue(TTS_MODELS, form.audioModel),
      detail: form.audioModel,
    },
    {
      name: "selected voice is supported",
      pass: isSupportedValue(VOICES, form.voice),
      detail: form.voice,
    },
    {
      name: "selected response format is supported",
      pass: isSupportedValue(AUDIO_FORMATS, form.responseFormat),
      detail: form.responseFormat,
    },
    {
      name: "slide id is present",
      pass: form.slideId.trim().length > 0,
      detail: form.slideId || "missing",
    },
    {
      name: "script is narration-only text",
      pass: !/\b(system|developer|prompt|instruction|write a|generate a)\b/i.test(form.scriptText),
      detail: "blocks obvious prompt/instruction leakage",
    },
  ];
}

function buildSpeechPayload(form: FormState) {
  return {
    model: form.audioModel,
    voice: form.voice,
    response_format: form.responseFormat,
    input: form.scriptText.trim(),
  };
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
      {children}
    </label>
  );
}

function NativeSelect<T extends string>({
  id,
  value,
  values,
  onChange,
}: {
  id: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as T)}
      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
    >
      {values.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}

export default function App() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const tests = useMemo(() => runSelfTests(form), [form]);
  const allTestsPass = tests.every((test) => test.pass);
  const payload = useMemo(() => buildSpeechPayload(form), [form]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const canGenerate = form.scriptText.trim().length > 0 && allTestsPass;

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="grid gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-xl font-bold text-white shadow-sm">
              A
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Slide Audio Builder</h1>
              <p className="text-sm text-slate-600">
                Configure one narration file per slide using dependency-free, type-safe controls.
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <FieldLabel htmlFor="lessonTitle">Lesson title</FieldLabel>
                  <input
                    id="lessonTitle"
                    value={form.lessonTitle}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateForm("lessonTitle", event.target.value)
                    }
                    placeholder="Example: Oxygenation"
                    className="h-10 rounded-xl border border-slate-300 px-3 text-sm shadow-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div className="grid gap-2">
                  <FieldLabel htmlFor="slideId">Slide ID</FieldLabel>
                  <input
                    id="slideId"
                    value={form.slideId}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateForm("slideId", event.target.value)
                    }
                    placeholder="S001"
                    className="h-10 rounded-xl border border-slate-300 px-3 text-sm shadow-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <FieldLabel htmlFor="audioModel">Audio model</FieldLabel>
                  <NativeSelect<TtsModel>
                    id="audioModel"
                    value={form.audioModel}
                    values={TTS_MODELS}
                    onChange={(value) => updateForm("audioModel", value)}
                  />
                </div>

                <div className="grid gap-2">
                  <FieldLabel htmlFor="voice">Voice</FieldLabel>
                  <NativeSelect<Voice>
                    id="voice"
                    value={form.voice}
                    values={VOICES}
                    onChange={(value) => updateForm("voice", value)}
                  />
                </div>

                <div className="grid gap-2">
                  <FieldLabel htmlFor="responseFormat">Format</FieldLabel>
                  <NativeSelect<AudioFormat>
                    id="responseFormat"
                    value={form.responseFormat}
                    values={AUDIO_FORMATS}
                    onChange={(value) => updateForm("responseFormat", value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <FieldLabel htmlFor="scriptText">Teleprompter script</FieldLabel>
                <textarea
                  id="scriptText"
                  value={form.scriptText}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                    updateForm("scriptText", event.target.value)
                  }
                  placeholder="Paste only the narration text the lecturer should speak. Do not paste prompt instructions."
                  className="min-h-44 resize-y rounded-xl border border-slate-300 p-3 text-sm shadow-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!canGenerate}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Prepare audio payload
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm"
                  onClick={() => setForm(DEFAULT_FORM)}
                >
                  Reset
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-6">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid gap-4 p-6">
                <div>
                  <h2 className="text-xl font-semibold">Build checks</h2>
                  <p className="text-sm text-slate-500">These checks run without external icon or select packages.</p>
                </div>
                <div className="grid gap-2">
                  {tests.map((test) => (
                    <div
                      key={test.name}
                      className="flex items-start justify-between gap-3 rounded-xl border bg-white p-3"
                    >
                      <div>
                        <p className="font-medium">{test.name}</p>
                        <p className="text-xs text-slate-500">{test.detail}</p>
                      </div>
                      <span
                        className={
                          test.pass
                            ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                        }
                      >
                        {test.pass ? "pass" : "fail"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid gap-3 p-6">
                <div>
                  <h2 className="text-xl font-semibold">Speech request payload</h2>
                  <p className="text-sm text-slate-500">Use this object for backend TTS generation.</p>
                </div>
                <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-50">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
