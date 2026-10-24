"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEVICE_VIEW, LEVEL_VIEW, SERVICE_VIEW, replayView, type ReplayView as ReplayViewModel, type Swatch } from "@/lib/propagation/adapter";
import {
  LEVERS,
  liveReplay,
  loadRun,
  loadRunIndex,
  type LeverId,
  type RunIndex,
  type RunMeta,
} from "@/lib/propagation/use-replay-view";
import type { Level, ReplayResult } from "@/lib/propagation/types";

const LEVEL_ORDER: Level[] = ["clean", "footholded", "cred_holder", "controlled", "encrypted"];

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />;
}

function Swatches({ entries }: { entries: [string, Swatch][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-ink-muted">
      {entries.map(([key, swatch]) => (
        <span key={key} className="flex items-center gap-1.5">
          <Dot color={swatch.color} /> {swatch.label}
        </span>
      ))}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        {hint ? <span className="text-[11px] text-ink-faint">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function ReplayBody({ view }: { view: ReplayViewModel }) {
  const levelCounts = useMemo(() => {
    const counts = new Map<Level, number>();
    for (const host of view.hosts) counts.set(host.level, (counts.get(host.level) ?? 0) + 1);
    return counts;
  }, [view.hosts]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Encrypted hosts", String(view.totals.encryptedHosts)],
          ["Medical devices encrypted", String(view.totals.medicalDevicesEncrypted)],
          ["Services down", String(view.totals.servicesDown.length)],
          ["Services on paper", String(view.totals.servicesOnPaper.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-surface p-3">
            <div className="num text-xl text-ink">{value}</div>
            <div className="text-[11px] text-ink-muted">{label}</div>
          </div>
        ))}
      </div>

      <Section title="Services" hint="up · on paper · down">
        <ul className="flex flex-col gap-2">
          {view.services.map((service) => (
            <li key={service.name} className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-[13px] text-ink">
                <Dot color={service.color} />
                {service.name}
                <span className="text-[11px] text-ink-faint">· {service.label}</span>
              </span>
              {service.causes.length > 0 ? (
                <span className="pl-[18px] text-[11px] text-ink-faint">{service.causes.join(", ")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      {view.planInducedServiceLoss.length > 0 ? (
        <Section title="Plan-induced service loss" hint="before any attack step">
          <ul className="flex flex-col gap-1 text-[13px]">
            {view.planInducedServiceLoss.map((service) => (
              <li key={service.name} className="flex items-center gap-2">
                <Dot color={service.color} /> {service.name}
                <span className="text-[11px] text-ink-faint">· {service.label}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {view.blockedPreconditions.length > 0 ? (
        <Section title="Blocked preconditions" hint="actual trace blockers">
          <ul className="flex flex-col gap-2 text-[12px]">
            {view.blockedPreconditions.map((blocked, index) => (
              <li key={`${blocked.rule}-${blocked.node ?? "n"}-${index}`} className="border-l-2 border-line pl-3">
                <span className="num text-ink">{blocked.rule}</span>
                {blocked.node ? <span className="text-ink-muted"> → {blocked.node}</span> : null}
                <div className="text-ink-faint">{blocked.reason}</div>
                {blocked.blockers.map((b) => (
                  <div key={b.code} className="text-ink-faint">
                    · {b.code}: {b.detail}
                    {b.levers.length > 0 ? <span className="text-ink-muted"> (levers: {b.levers.join(", ")})</span> : null}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Hosts" hint={`${view.hosts.length} nodes`}>
        <div className="mb-3">
          <Swatches entries={LEVEL_ORDER.map((level) => [level, LEVEL_VIEW[level]])} />
        </div>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
          {LEVEL_ORDER.filter((level) => (levelCounts.get(level) ?? 0) > 0).map((level) => (
            <span key={level} className="num">
              {LEVEL_VIEW[level].label}: {levelCounts.get(level)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {view.hosts.map((host) => (
            <span
              key={host.id}
              title={`${host.id} · ${host.label}`}
              className="flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-muted"
            >
              <Dot color={host.color} />
              {host.id}
            </span>
          ))}
        </div>
      </Section>

      {view.devices.length > 0 ? (
        <Section title="Medical devices" hint="operational · dependency outage">
          <div className="mb-3">
            <Swatches entries={Object.entries(DEVICE_VIEW)} />
          </div>
          <div className="flex flex-wrap gap-1">
            {view.devices.map((device) => (
              <span
                key={device.id}
                title={`${device.id} · ${device.label}`}
                className="flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-muted"
              >
                <Dot color={device.color} />
                {device.id}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {view.disclosed ? (
        <Section title="Disclosed reconstruction" hint={`${view.assumptions.length} assumptions`}>
          <ul className="flex flex-col gap-1.5 text-[11px] text-ink-muted">
            {view.assumptions.map((assumption) => (
              <li key={assumption.id} className="flex gap-2">
                <span className="num shrink-0 text-ink-faint">[{assumption.provenance}]</span>
                <span>{assumption.statement}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Swatches entries={[...Object.entries(SERVICE_VIEW)].map(([k, v]) => [`svc-${k}`, v])} />
    </div>
  );
}

type Loaded = { result: ReplayResult; cached: boolean; label: string };
type RunLogEntry = { id: number; label: string; cached: boolean; encrypted: number; down: number; paper: number; result: ReplayResult };

export function ReplayView() {
  const [mode, setMode] = useState<"offline" | "live">("offline");
  const [index, setIndex] = useState<RunIndex | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Loaded | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [active, setActive] = useState<Set<LeverId>>(new Set());
  const [apiBase, setApiBase] = useState("http://localhost:8000");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const [log, setLog] = useState<RunLogEntry[]>([]);
  const logId = useRef(0);

  const record = useCallback((loaded: Loaded) => {
    setCurrent(loaded);
    const summary = loaded.result.summary;
    logId.current += 1;
    setLog((prev) => [
      {
        id: logId.current,
        label: loaded.label,
        cached: loaded.cached,
        encrypted: summary.encrypted_hosts?.length ?? 0,
        down: summary.services_down?.length ?? 0,
        paper: summary.services_on_paper?.length ?? 0,
        result: loaded.result,
      },
      ...prev,
    ].slice(0, 8));
  }, []);

  const pickOffline = useCallback(
    async (run: RunMeta) => {
      setSelectedKey(run.key);
      try {
        const result = await loadRun(run.file);
        record({ result, cached: true, label: run.label });
      } catch (error) {
        setIndexError(String(error));
      }
    },
    [record],
  );

  useEffect(() => {
    let cancelled = false;
    loadRunIndex()
      .then((loaded) => {
        if (cancelled) return;
        setIndex(loaded);
        const first = loaded.runs.find((run) => run.key === "undefended") ?? loaded.runs[0];
        if (first) void pickOffline(first);
      })
      .catch((error) => !cancelled && setIndexError(String(error)));
    return () => {
      cancelled = true;
    };
  }, [pickOffline]);

  const runLive = useCallback(async () => {
    setLiveLoading(true);
    setLiveError(null);
    try {
      const result = await liveReplay(apiBase, active);
      const names = LEVERS.filter((l) => active.has(l.id)).map((l) => l.label);
      record({ result, cached: false, label: `Live · ${names.length ? names.join(" + ") : "no levers"}` });
    } catch (error) {
      setLiveError(`${error}. Is the server running?  (uv run uvicorn sim_core.api:app)`);
    } finally {
      setLiveLoading(false);
    }
  }, [apiBase, active, record]);

  const view = useMemo(
    () => (current ? replayView(current.result, { cached: current.cached, disclosed: true }) : null),
    [current],
  );

  const grouped = useMemo(() => {
    const groups: Record<string, RunMeta[]> = { plan: [], "single-lever": [], sensitivity: [] };
    for (const run of index?.runs ?? []) (groups[run.group] ??= []).push(run);
    return groups;
  }, [index]);

  return (
    <div className="min-h-screen bg-bg px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold">Propagation replay</h1>
            <span className="text-[11px] text-ink-faint">render-only · the simulation runs server-side, never in the browser</span>
          </div>

          {view?.disclosed ? (
            <p className="rounded-md border border-line bg-raised px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
              Disclosed reconstruction — synthetic CUH inventory, exploratory campaign ([S]/[I]). Not a real
              hospital. Served from{" "}
              <span className="num text-ink">{view.cached ? "a frozen run" : "a live server replay"}</span>, rules{" "}
              <span className="num text-ink">{view.rulesVersion || "—"}</span>, key{" "}
              <span className="num text-ink-faint">{view.cacheKey.slice(0, 12)}…</span>
            </p>
          ) : null}

          <div className="flex gap-2">
            {(["offline", "live"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md border px-3 py-1.5 text-[12px] transition-colors ${
                  mode === m ? "border-ink/40 bg-raised text-ink" : "border-line bg-surface text-ink-muted hover:text-ink"
                }`}
              >
                {m === "offline" ? "Offline frozen runs" : "Live server"}
              </button>
            ))}
          </div>
        </header>

        {mode === "offline" ? (
          <section className="rounded-lg border border-line bg-surface p-4">
            {indexError ? <p className="text-[12px] text-state-disrupted">Could not load runs: {indexError}</p> : null}
            {(["plan", "single-lever", "sensitivity"] as const).map((group) =>
              grouped[group]?.length ? (
                <div key={group} className="mb-3 last:mb-0">
                  <div className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-faint">{group.replace("-", " ")}</div>
                  <div className="flex flex-wrap gap-2">
                    {grouped[group].map((run) => (
                      <button
                        key={run.key}
                        type="button"
                        title={run.description}
                        onClick={() => void pickOffline(run)}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors ${
                          selectedKey === run.key ? "border-ink/40 bg-raised text-ink" : "border-line bg-bg text-ink-muted hover:text-ink"
                        }`}
                      >
                        {run.label}
                        <span className="num rounded bg-surface px-1 text-[10px]" style={{ color: run.encrypted_hosts ? SERVICE_VIEW.down.color : SERVICE_VIEW.up.color }}>
                          {run.encrypted_hosts} enc
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </section>
        ) : (
          <section className="rounded-lg border border-line bg-surface p-4">
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
              {LEVERS.map((lever) => (
                <label key={lever.id} className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-muted">
                  <input
                    type="checkbox"
                    checked={active.has(lever.id)}
                    onChange={(event) =>
                      setActive((prev) => {
                        const next = new Set(prev);
                        if (event.target.checked) next.add(lever.id);
                        else next.delete(lever.id);
                        return next;
                      })
                    }
                  />
                  {lever.label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={apiBase}
                onChange={(event) => setApiBase(event.target.value)}
                className="w-56 rounded border border-line bg-bg px-2 py-1 text-[12px] text-ink"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => void runLive()}
                disabled={liveLoading}
                className="rounded-md border border-ink/40 bg-raised px-3 py-1.5 text-[12px] text-ink disabled:opacity-50"
              >
                {liveLoading ? "Running…" : "Run"}
              </button>
            </div>
            {liveError ? <p className="mt-2 text-[12px] text-state-disrupted">{liveError}</p> : null}
          </section>
        )}

        {log.length > 1 ? (
          <section className="rounded-lg border border-line bg-surface p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-ink-faint">Runs</div>
            <div className="flex flex-col gap-1 text-[12px]">
              {log.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setCurrent({ result: entry.result, cached: entry.cached, label: entry.label })}
                  className="flex items-center justify-between gap-3 rounded px-2 py-1 text-left hover:bg-raised"
                >
                  <span className="truncate text-ink-muted">{entry.label}</span>
                  <span className="num shrink-0 text-ink-faint">
                    {entry.encrypted} enc · {entry.down} down · {entry.paper} paper
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {view ? <ReplayBody view={view} /> : <p className="text-[12px] text-ink-faint">Loading run…</p>}
      </div>
    </div>
  );
}
