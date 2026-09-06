const frameworkCoverage = [
  { label: "Client Needs categories", value: 8, total: 8 },
  { label: "Integrated processes", value: 6, total: 6 },
  { label: "Clinical judgment functions", value: 6, total: 6 },
];

const contentCounts = [
  { label: "Exemplar topics", value: "8" },
  { label: "Objectives", value: "24" },
  { label: "Original items", value: "120" },
  { label: "Case-study items", value: "48" },
];

const exportFiles = [
  "Curriculum manifest",
  "Canvas Outcomes CSV",
  "QTI question bank",
  "Common Cartridge",
  "Pathway rules",
  "Execution status",
];

const productionSteps = [
  { label: "Framework contract", state: "Complete", tone: "pass" },
  { label: "Eight-category draft batch", state: "Complete", tone: "pass" },
  { label: "Automated QA", state: "Passing", tone: "pass" },
  { label: "Licensed RN review", state: "8 awaiting review", tone: "hold" },
  { label: "Public release", state: "Blocked until approval", tone: "hold" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f7f6] text-[#17211f]">
      <header className="border-b border-[#d8dfdc] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#0f766e] text-sm font-black text-white">NS</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0f766e]">Execute to Goal</p>
              <p className="text-sm font-semibold text-[#46534f]">Open NCLEX Curriculum</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#f0c78f] bg-[#fff8ed] px-3 py-2 text-xs font-bold text-[#8a4b08]">
            <span className="h-2 w-2 rounded-full bg-[#d97706]" aria-hidden="true" />
            Clinical review milestone
          </div>
        </div>
      </header>

      <section className="border-b border-[#d8dfdc] px-5 py-9">
        <div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#0f766e]">NCLEX-RN 2026</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.025em] sm:text-5xl">
              Curriculum execution, with the evidence visible.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[#53615d]">
              NurseStudy remains the curriculum system of record. This private dashboard reports aggregate mapping,
              content production, clinical review, and Canvas-portable release readiness.
            </p>
          </div>
          <aside className="rounded-lg border border-[#cdd7d3] bg-white p-5 shadow-[0_18px_50px_rgba(23,33,31,0.08)]">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#596662]">Latest release</p>
            <h2 className="mt-2 text-xl font-semibold">Eight-category exemplar milestone</h2>
            <p className="mt-3 text-sm leading-6 text-[#53615d]">
              Portable exports are valid. All eight generated packages remain withheld from release pending licensed RN approval.
            </p>
          </aside>
        </div>
      </section>

      <section className="px-5 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-3">
            {frameworkCoverage.map((metric) => {
              const percent = Math.round((metric.value / metric.total) * 100);
              return (
                <article key={metric.label} className="rounded-lg border border-[#d8dfdc] bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold text-[#53615d]">{metric.label}</p>
                    <span className="text-sm font-bold text-[#0f766e]">{percent}%</span>
                  </div>
                  <p className="mt-4 text-3xl font-bold">{metric.value}<span className="text-lg font-medium text-[#81908b]">/{metric.total}</span></p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e6eeeb]">
                    <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${percent}%` }} />
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-lg border border-[#d8dfdc] bg-white">
              <div className="border-b border-[#d8dfdc] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#0f766e]">Production batch</p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-2xl font-semibold">Eight exemplar topics</h2>
                  <span className="rounded-md bg-[#fff2dc] px-3 py-1.5 text-xs font-bold text-[#8a4b08]">Clinical review</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-[#d8dfdc] sm:grid-cols-4">
                {contentCounts.map((metric) => (
                  <div key={metric.label} className="bg-white p-5">
                    <p className="text-3xl font-bold text-[#17211f]">{metric.value}</p>
                    <p className="mt-2 text-sm leading-5 text-[#61706b]">{metric.label}</p>
                  </div>
                ))}
              </div>
              <ol className="divide-y divide-[#e4e9e7] px-5 sm:px-6">
                {productionSteps.map((step, index) => (
                  <li key={step.label} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-4">
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${step.tone === "pass" ? "bg-[#ccfbf1] text-[#115e59]" : "bg-[#fff2dc] text-[#8a4b08]"}`}>{index + 1}</span>
                    <span className="text-sm font-semibold">{step.label}</span>
                    <span className={`text-right text-xs font-bold ${step.tone === "pass" ? "text-[#0f766e]" : "text-[#b45309]"}`}>{step.state}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid gap-6">
              <section className="rounded-lg border border-[#d8dfdc] bg-[#17211f] p-5 text-white sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#5eead4]">Clinical safety gate</p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div><p className="text-4xl font-bold">8</p><p className="mt-1 text-sm text-[#bac8c4]">Awaiting licensed RN review</p></div>
                  <div className="text-right"><p className="text-4xl font-bold">0</p><p className="mt-1 text-sm text-[#bac8c4]">Approved for release</p></div>
                </div>
                <p className="mt-5 border-t border-[#35433f] pt-4 text-sm leading-6 text-[#d6e0dd]">
                  Topic/source alignment and explicit RN attestation are required before a lesson can become public.
                </p>
              </section>

              <section className="rounded-lg border border-[#d8dfdc] bg-white p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#9f4d3b]">Canvas portability</p>
                <h2 className="mt-2 text-xl font-semibold">Six validated artifacts</h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {exportFiles.map((file) => <li key={file} className="flex items-center gap-2 text-sm text-[#53615d]"><span className="text-[#0f766e]">✓</span>{file}</li>)}
                </ul>
              </section>
            </div>
          </div>

          <section className="mt-6 grid gap-4 rounded-lg border border-[#e8c99f] bg-[#fffaf2] p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#9a570c]">Current blocker</p>
              <h2 className="mt-2 text-xl font-semibold">Faculty validation, then full-curriculum batching</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-[#68584a]">
                The automated contract is passing. The next valid state change is licensed review of the eight exemplars; generated drafts are not represented as approved clinical curriculum.
              </p>
            </div>
            <span className="rounded-md border border-[#e8c99f] bg-white px-4 py-2 text-center text-sm font-bold text-[#8a4b08]">Release held safely</span>
          </section>
        </div>
      </section>

      <footer className="border-t border-[#d8dfdc] bg-white px-5 py-5 text-center text-xs text-[#6b7974]">
        Aggregate execution status only · No learner or patient data · NurseStudy is the system of record
      </footer>
    </main>
  );
}
