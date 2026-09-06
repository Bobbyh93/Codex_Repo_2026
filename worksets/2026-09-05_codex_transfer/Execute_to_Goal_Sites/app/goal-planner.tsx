"use client";

import { useMemo, useState } from "react";

const modes = ["Sprint", "Build", "Recover"] as const;
const horizons = ["Today", "7 days", "30 days"] as const;
const checks = ["Owner named", "Blocker visible", "Proof defined"] as const;

type Mode = (typeof modes)[number];
type Horizon = (typeof horizons)[number];

function clampScore(value: number) {
  return Math.max(18, Math.min(98, value));
}

export default function GoalPlanner() {
  const [goal, setGoal] = useState("Launch the first public version");
  const [mode, setMode] = useState<Mode>("Sprint");
  const [horizon, setHorizon] = useState<Horizon>("7 days");
  const [effort, setEffort] = useState(3);
  const [clarity, setClarity] = useState(68);
  const [selectedChecks, setSelectedChecks] = useState<string[]>([
    "Owner named",
    "Proof defined",
  ]);

  const score = useMemo(() => {
    const base = clarity * 0.55 + effort * 8 + selectedChecks.length * 9;
    return Math.round(clampScore(base));
  }, [clarity, effort, selectedChecks.length]);

  const actions = useMemo(() => {
    const normalizedGoal = goal.trim() || "the current goal";
    const blocker =
      mode === "Recover"
        ? "stabilize the part that keeps reopening"
        : mode === "Build"
          ? "turn the core decision into a shippable artifact"
          : "remove the smallest blocker with the largest consequence";

    return [
      `Name done for "${normalizedGoal}" in one sentence.`,
      `For ${horizon.toLowerCase()}, ${blocker}.`,
      `Collect one proof point before adding another task.`,
    ];
  }, [goal, horizon, mode]);

  function toggleCheck(label: string) {
    setSelectedChecks((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    );
  }

  return (
    <section
      id="plan"
      aria-label="Goal execution planner"
      className="min-w-0 rounded-lg border border-[#cbd5d1] bg-white shadow-[0_24px_80px_rgba(23,33,31,0.12)]"
    >
      <div className="border-b border-[#d9dfdc] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="panel-kicker text-xs font-bold uppercase tracking-[0.18em] text-[#0f766e]">
              Run builder
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal text-[#17211f]">
              Current run
            </h2>
          </div>
          <div className="w-full rounded-md border border-[#d9dfdc] bg-[#f6f8f7] p-3 sm:w-40">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#53615d]">
              Readiness
            </p>
            <p className="mt-1 text-3xl font-bold text-[#0f766e]">{score}%</p>
          </div>
        </div>

        <label className="mt-5 block text-sm font-semibold text-[#17211f]" htmlFor="goal">
          Goal
        </label>
        <input
          id="goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          className="mt-2 w-full rounded-md border border-[#bfc9c5] bg-white px-4 py-3 text-base text-[#17211f] outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#99f6e4]"
        />
      </div>

      <div className="grid min-w-0 gap-0 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="min-w-0 border-b border-[#d9dfdc] p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div>
            <p className="text-sm font-semibold text-[#17211f]">Mode</p>
            <div className="mt-3 grid min-w-0 grid-cols-3 rounded-md border border-[#bfc9c5] p-1">
              {modes.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={`min-h-10 min-w-0 rounded-[6px] px-2 text-sm font-semibold transition ${
                    mode === item
                      ? "bg-[#17211f] text-white"
                      : "text-[#53615d] hover:bg-[#eef3f1]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-[#17211f]">Horizon</p>
            <div className="mt-3 grid min-w-0 grid-cols-3 gap-2">
              {horizons.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setHorizon(item)}
                  className={`min-h-10 min-w-0 rounded-md border px-2 text-sm font-semibold transition ${
                    horizon === item
                      ? "border-[#0f766e] bg-[#ccfbf1] text-[#115e59]"
                      : "border-[#d9dfdc] text-[#53615d] hover:border-[#0f766e]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-5">
            <label className="block">
              <span className="flex items-center justify-between text-sm font-semibold text-[#17211f]">
                Effort level
                <span className="text-[#b45309]">{effort}</span>
              </span>
              <input
                type="range"
                min="1"
                max="5"
                value={effort}
                onChange={(event) => setEffort(Number(event.target.value))}
                className="mt-3 w-full accent-[#b45309]"
              />
            </label>

            <label className="block">
              <span className="flex items-center justify-between text-sm font-semibold text-[#17211f]">
                Clarity
                <span className="text-[#0f766e]">{clarity}%</span>
              </span>
              <input
                type="range"
                min="10"
                max="100"
                value={clarity}
                onChange={(event) => setClarity(Number(event.target.value))}
                className="mt-3 w-full accent-[#0f766e]"
              />
            </label>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-[#17211f]">Run checks</legend>
            <div className="mt-3 grid gap-2">
              {checks.map((item) => (
                <label
                  key={item}
                  className="flex min-h-11 items-center gap-3 rounded-md border border-[#d9dfdc] px-3 text-sm font-medium text-[#53615d]"
                >
                  <input
                    type="checkbox"
                    checked={selectedChecks.includes(item)}
                    onChange={() => toggleCheck(item)}
                    className="h-4 w-4 accent-[#0f766e]"
                  />
                  {item}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="panel-kicker text-xs font-bold uppercase tracking-[0.18em] text-[#9f4d3b]">
                Next moves
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[#17211f]">Execution lane</h3>
            </div>
            <div className="h-14 w-14 rounded-md bg-[#17211f] p-2">
              <div
                className="h-full rounded-[4px] bg-[#2dd4bf]"
                style={{ transform: `scaleY(${score / 100})`, transformOrigin: "bottom" }}
              />
            </div>
          </div>

          <ol className="mt-5 grid gap-3">
            {actions.map((action, index) => (
              <li key={action} className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 border-t border-[#d9dfdc] pt-4">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-[#f59e0b] text-sm font-bold text-[#17211f]">
                  {index + 1}
                </span>
                <p className="min-w-0 text-sm leading-7 text-[#53615d]">{action}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 border-t border-[#d9dfdc] pt-5">
            <div className="h-3 overflow-hidden rounded-sm bg-[#e6ebe8]">
              <div className="h-full bg-[#0f766e]" style={{ width: `${score}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#53615d]">
              <span>Define</span>
              <span>Move</span>
              <span>Prove</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
