"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Icon } from "@iconify/react";
import { useJobs, usePods } from "@/lib/hooks";
import { JOB_STATUS_CONFIG, STEP_DISPLAY, isActive, isFailed } from "@/lib/db-types";
import type { DbJob, DbJobEvent } from "@/lib/db-types";
import { AmbientBackground } from "@/components/AmbientBackground";

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "Now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
}

// ═══════════════════  STEP TIMELINE  ═══════════════════

function StepTimeline({ events }: { events: DbJobEvent[] }) {
  if (!events.length) return null;

  return (
    <div className="space-y-1 mt-3">
      {events.map((ev, i) => {
        const display = STEP_DISPLAY[ev.step || ev.event_type] || { icon: "solar:record-circle-linear", label: ev.step || ev.event_type };
        const isErr = (ev.step || ev.event_type).includes("fail") || (ev.step || ev.event_type).includes("timeout");
        const isDone = (ev.step || ev.event_type).includes("completed") || (ev.step || ev.event_type) === "job.completed";
        const isLast = i === events.length - 1;

        return (
          <div key={ev.id} className="flex gap-3 items-start">
            {/* Vertical line + dot */}
            <div className="flex flex-col items-center w-5 shrink-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                isErr ? "bg-red-50 text-red-500" :
                isDone ? "bg-emerald-50 text-emerald-500" :
                isLast ? "bg-neutral-900 text-white" :
                "bg-neutral-100 text-neutral-400"
              }`}>
                <Icon icon={display.icon} width={12} height={12} />
              </div>
              {i < events.length - 1 && <div className="w-px flex-1 min-h-[16px] bg-neutral-100" />}
            </div>

            {/* Content */}
            <div className="pb-2 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${isErr ? "text-red-600" : isDone ? "text-emerald-600" : "text-neutral-700"}`}>
                  {display.label}
                </span>
                {ev.duration_ms != null && (
                  <span className="text-[10px] text-neutral-400 font-geist-mono">
                    {ev.duration_ms >= 1000 ? `${(ev.duration_ms / 1000).toFixed(1)}s` : `${ev.duration_ms}ms`}
                  </span>
                )}
                <span className="text-[10px] text-neutral-300 font-geist-mono">
                  {new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
              {Boolean(ev.event_data?.error) && (
                <p className="text-[11px] text-red-400 font-geist-mono mt-0.5 break-all">{String(ev.event_data.error)}</p>
              )}
              {ev.event_data?.attempt != null && Number(ev.event_data.attempt) > 1 && (
                <span className="text-[10px] text-amber-500 font-geist-mono">attempt {String(ev.event_data.attempt)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════  MAIN DASHBOARD  ═══════════════════

export function Dashboard() {
  const { jobs, createJob, planJob, executeJob, retryJob, cancelJob } = useJobs();
  const { pods, createPod } = usePods();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);

  const readyPods = pods.filter((p) => p.status === "ready");
  const activePods = pods.filter((p) => !["terminated", "stopped"].includes(p.status));
  const activeJob = useMemo(() => jobs.find((j) => j.id === activeJobId) || null, [jobs, activeJobId]);

  const filtered = useMemo(() =>
    jobs.filter((j) => !search || (j.input_text || "").toLowerCase().includes(search.toLowerCase())),
    [jobs, search]
  );

  const activeJobs = filtered.filter((j) => isActive(j.status));
  const doneJobs = filtered.filter((j) => !isActive(j.status));

  useEffect(() => {
    if (ta.current) { ta.current.style.height = "auto"; ta.current.style.height = Math.max(60, ta.current.scrollHeight) + "px"; }
  }, [inputText]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    setSending(true);
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const { data: job, ok } = await createJob(inputText, key);
      if (ok) {
        setActiveJobId(job.id);
        setInputText("");
        await planJob(job.id);
      }
    } catch (e) { console.error(e); }
    setSending(false);
  };

  const handleRetry = async (jobId: string) => {
    const { ok, data } = await retryJob(jobId);
    if (ok) {
      // Re-enter the pipeline based on where it retries to
      if (data.status === "created") await planJob(jobId);
      if (data.status === "queued") await executeJob(jobId);
    }
  };

  return (
    <>
      <AmbientBackground />

      {/* ── LEFT ICON RAIL ── */}
      <aside className="hidden lg:flex w-28 flex-col items-center justify-center h-full z-40 shrink-0 pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-2 bg-white/90 backdrop-blur-md border border-neutral-200/80 rounded-full p-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white mb-2 shadow-sm cursor-pointer hover:bg-neutral-800 transition-colors">
            <Icon icon="solar:box-minimalistic-linear" width={20} height={20} />
          </div>
          <div className="w-full h-px bg-neutral-100 mb-2" />
          <NavBtn icon="solar:home-angle-linear" label="Home" />
          <NavBtn icon="solar:chat-round-line-linear" label="Threads" active />
          <NavBtn icon="solar:play-circle-linear" label="Runs" />
          <NavBtn icon="solar:safe-square-linear" label="Vault" />
          <div className="w-full h-px bg-neutral-100 mt-2 mb-2" />
          <NavBtn icon="solar:settings-linear" label="Settings" />
        </div>
      </aside>

      {/* ── SIDEBAR ── */}
      <aside className="hidden md:flex w-[320px] flex-col bg-white/60 backdrop-blur-2xl border-r border-neutral-200/60 z-30 shrink-0">
        <div className="p-5 flex flex-col gap-4">
          <button onClick={() => setActiveJobId(null)} className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-all shadow-[0_4px_12px_rgb(0,0,0,0.08)]">
            <Icon icon="solar:pen-new-square-linear" width={18} height={18} />
            New Generation
          </button>
          <div className="relative group">
            <Icon icon="solar:magnifer-linear" width={16} height={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-neutral-700 transition-colors" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs" className="w-full bg-neutral-100/60 border border-transparent hover:border-neutral-200 focus:border-neutral-300 focus:bg-white text-sm rounded-xl pl-9 pr-4 py-2 outline-none transition-all text-neutral-800 placeholder:text-neutral-400" />
          </div>
        </div>

        {activePods.length > 0 && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-50/80 border border-neutral-100">
              <Icon icon="solar:cpu-bolt-linear" width={14} height={14} className="text-neutral-400" />
              <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest font-geist-mono">
                {readyPods.length > 0 ? `${readyPods.length} pod ready` : `${activePods.length} pod starting`}
              </span>
              {readyPods.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative ml-auto"><span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-40" /></span>}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {filtered.length === 0 ? (
            <div className="px-2 pt-8 text-center text-xs text-neutral-400 font-geist-mono">No jobs yet</div>
          ) : (
            <>
              {activeJobs.length > 0 && (
                <>
                  <div className="px-2 pt-2 pb-2 text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">Active</div>
                  {activeJobs.map((j) => <JobRow key={j.id} job={j} active={j.id === activeJobId} onClick={() => setActiveJobId(j.id)} />)}
                </>
              )}
              {doneJobs.length > 0 && (
                <>
                  <div className="px-2 pt-6 pb-2 text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">Recent</div>
                  {doneJobs.map((j) => <JobRow key={j.id} job={j} active={j.id === activeJobId} onClick={() => setActiveJobId(j.id)} />)}
                </>
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col relative min-w-0 z-20 pointer-events-none">
        <header className="h-20 flex items-center justify-between px-8 z-30 shrink-0">
          <div />
          <div className="pointer-events-auto flex items-center gap-3">
            {activePods.length === 0 && (
              <button onClick={() => createPod({ gpu: "standard" })} className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200/80 bg-white/80 backdrop-blur-md shadow-sm hover:bg-white hover:border-neutral-300 transition-all text-xs font-medium text-neutral-700 font-geist-mono">
                <Icon icon="solar:cpu-bolt-linear" width={14} height={14} /> Launch Pod
              </button>
            )}
            <button className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200/80 bg-white/80 backdrop-blur-md shadow-sm hover:bg-white hover:border-neutral-300 transition-all text-xs font-medium text-neutral-700 font-geist-mono">
              OpenRouter / Claude 3.5
              <Icon icon="solar:alt-arrow-down-linear" width={14} height={14} className="text-neutral-400" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full pointer-events-auto flex flex-col items-center pb-8 px-4">
          <div className="w-full max-w-3xl flex flex-col gap-10 mt-4 md:mt-12">
            {!activeJob ? (
              /* ── EMPTY STATE ── */
              <div className="flex flex-col items-center text-center w-full mb-8">
                <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-neutral-900 mb-3">{greeting()}</h1>
                <p className="text-base text-neutral-500 font-geist-mono">What are we generating today?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-12">
                  {[
                    { icon: "solar:pallete-2-linear", title: "Cinematic portrait", desc: "Golden hour, SDXL with film grain LoRA.", prompt: "Cinematic portrait of a woman in golden hour light, film grain, shallow depth of field" },
                    { icon: "solar:box-minimalistic-linear", title: "Product shot", desc: "Studio lighting on marble surface.", prompt: "Product photography of a luxury perfume bottle on white marble, studio lighting" },
                    { icon: "solar:star-shine-linear", title: "Anime illustration", desc: "Cyberpunk city, neon reflections.", prompt: "Anime girl in cyberpunk city at night, neon lights, wet streets, detailed illustration" },
                    { icon: "solar:mountains-linear", title: "Landscape", desc: "Mountain sunset, dramatic clouds.", prompt: "Epic landscape of snow-capped mountains at sunset with dramatic orange and purple clouds" },
                  ].map((t) => (
                    <button key={t.title} onClick={() => setInputText(t.prompt)} className="flex flex-col text-left p-5 rounded-2xl border border-neutral-200/60 bg-white/40 backdrop-blur-md hover:bg-white hover:border-neutral-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all group">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Icon icon={t.icon} width={16} height={16} />
                      </div>
                      <h3 className="text-sm font-medium text-neutral-900 mb-2">{t.title}</h3>
                      <p className="text-xs text-neutral-500 leading-relaxed font-geist-mono">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── ACTIVE JOB ── */
              <>
                <div className="w-full flex items-center gap-4 opacity-40">
                  <div className="h-px flex-1 bg-neutral-300" />
                  <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">Job · Attempt {activeJob.attempt}</span>
                  <div className="h-px flex-1 bg-neutral-300" />
                </div>

                <div className="flex flex-col gap-8 w-full">
                  {/* User message */}
                  <div className="ml-auto w-full max-w-xl bg-neutral-100/80 border border-neutral-200/50 backdrop-blur-sm rounded-[24px] rounded-tr-sm p-5 text-sm text-neutral-800 leading-relaxed shadow-sm">
                    {activeJob.input_text}
                  </div>

                  {/* Agent response */}
                  <div className="mr-auto w-full max-w-2xl flex flex-col gap-4">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-6 h-6 rounded-md bg-neutral-900 flex items-center justify-center text-white">
                        <Icon icon="solar:box-minimalistic-linear" width={14} height={14} />
                      </div>
                      <span className="text-xs font-medium text-neutral-900 font-geist-mono">sandbox.fun</span>
                      <StatusBadge status={activeJob.status} />
                    </div>

                    <div className="bg-white border border-neutral-200/80 rounded-[24px] rounded-tl-sm p-6 text-sm text-neutral-800 leading-relaxed shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] space-y-4">
                      {/* Running pulse */}
                      {isActive(activeJob.status) && activeJob.status !== "created" && (
                        <div className="flex items-center gap-2 text-xs text-neutral-500 font-geist-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative"><span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-40" /></span>
                          {JOB_STATUS_CONFIG[activeJob.status]?.label}
                        </div>
                      )}

                      {/* Plan */}
                      {activeJob.plan && (
                        <>
                          <p>{"I'll use the "}<span className="font-medium text-black">{(activeJob.plan as Record<string,string>).template_slug}</span>{" template. "}{(activeJob.plan as Record<string,string>).reasoning}</p>
                          <details className="bg-neutral-50 border border-neutral-200/80 rounded-xl overflow-hidden shadow-inner font-geist-mono text-xs mt-2" open>
                            <summary className="px-4 py-3 bg-neutral-100/50 cursor-pointer text-neutral-600 font-medium border-b border-neutral-200/50 hover:bg-neutral-100 transition-colors flex items-center justify-between select-none">
                              <span className="flex items-center gap-2"><Icon icon="solar:code-square-linear" width={16} height={16} /> execution_plan.json <span className="text-neutral-400">v{activeJob.plan_version}</span></span>
                              <Icon icon="solar:alt-arrow-down-linear" width={14} height={14} className="opacity-50" />
                            </summary>
                            <div className="p-4 text-neutral-500 leading-relaxed overflow-x-auto"><pre><code>{JSON.stringify(activeJob.plan, null, 2)}</code></pre></div>
                          </details>
                        </>
                      )}

                      {/* Step timeline */}
                      {activeJob.events && (activeJob.events as DbJobEvent[]).length > 0 && (
                        <details className="bg-neutral-50 border border-neutral-200/80 rounded-xl overflow-hidden shadow-inner text-xs mt-2" open>
                          <summary className="px-4 py-3 bg-neutral-100/50 cursor-pointer text-neutral-600 font-medium border-b border-neutral-200/50 hover:bg-neutral-100 transition-colors flex items-center justify-between select-none">
                            <span className="flex items-center gap-2"><Icon icon="solar:timeline-up-linear" width={16} height={16} /> Step Timeline <span className="text-neutral-400 font-geist-mono">{(activeJob.events as DbJobEvent[]).length} events</span></span>
                            <Icon icon="solar:alt-arrow-down-linear" width={14} height={14} className="opacity-50" />
                          </summary>
                          <div className="p-4">
                            <StepTimeline events={activeJob.events as DbJobEvent[]} />
                          </div>
                        </details>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {activeJob.status === "created" && (
                          <button onClick={() => planJob(activeJob.id)} className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors shadow-sm">
                            <Icon icon="solar:routing-linear" width={14} height={14} /> Plan Workflow
                          </button>
                        )}
                        {activeJob.status === "planned" && (
                          <button onClick={() => executeJob(activeJob.id)} className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors shadow-sm">
                            <Icon icon="solar:play-circle-linear" width={14} height={14} /> Execute on GPU
                          </button>
                        )}
                        {isFailed(activeJob.status) && activeJob.retryable && activeJob.attempt < 3 && (
                          <button onClick={() => handleRetry(activeJob.id)} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-medium hover:bg-amber-500 transition-colors shadow-sm">
                            <Icon icon="solar:refresh-circle-linear" width={14} height={14} /> Retry (attempt {activeJob.attempt + 1}/3)
                          </button>
                        )}
                        {isActive(activeJob.status) && (
                          <button onClick={() => cancelJob(activeJob.id)} className="inline-flex items-center gap-2 px-3 py-2 text-neutral-400 hover:text-red-500 rounded-xl text-xs font-medium transition-colors">
                            <Icon icon="solar:stop-circle-linear" width={14} height={14} /> Cancel
                          </button>
                        )}
                      </div>

                      {/* Outputs */}
                      {activeJob.outputs && (activeJob.outputs as Array<{id:string;public_url:string;filename:string}>).length > 0 && (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          {(activeJob.outputs as Array<{id:string;public_url:string;filename:string}>).map((o) => (
                            <a key={o.id} href={o.public_url} target="_blank" rel="noopener noreferrer" className="rounded-2xl overflow-hidden border border-neutral-200/80 hover:border-neutral-300 hover:shadow-lg transition-all">
                              <img src={o.public_url} alt={o.filename} className="w-full aspect-square object-cover" />
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Error */}
                      {activeJob.last_error && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-xs text-red-600 font-geist-mono">
                          <span className="font-medium">Error:</span> {activeJob.last_error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="h-32" />
              </>
            )}
          </div>
        </div>

        {/* ── COMPOSER ── */}
        <div className="absolute bottom-0 w-full px-4 pb-6 pt-10 bg-gradient-to-t from-[#fafafa] via-[#fafafa]/90 to-transparent pointer-events-auto">
          <div className="max-w-3xl mx-auto w-full">
            <div className="relative bg-white border border-neutral-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-[28px] transition-all focus-within:shadow-[0_8px_30px_rgba(0,0,0,0.12)] focus-within:border-neutral-300 focus-within:ring-1 focus-within:ring-neutral-100 flex flex-col overflow-hidden">
              <textarea ref={ta} rows={1} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSend(); } }} placeholder="Describe what you want to generate..." className="w-full bg-transparent px-6 pt-5 pb-3 outline-none text-base text-neutral-800 placeholder:text-neutral-400 min-h-[60px]" />
              <div className="flex items-center justify-between px-4 pb-4 pt-2">
                <div className="flex items-center gap-2">
                  <button className="p-2.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors flex items-center justify-center relative group">
                    <Icon icon="solar:paperclip-linear" width={20} height={20} />
                    <span className="absolute -top-10 bg-neutral-900 text-white text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-geist-mono shadow-sm">Attach Context</span>
                  </button>
                  <button className="p-2.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors flex items-center justify-center relative group">
                    <Icon icon="solar:text-square-linear" width={20} height={20} />
                    <span className="absolute -top-10 bg-neutral-900 text-white text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-geist-mono shadow-sm">Templates</span>
                  </button>
                </div>
                <div className="flex items-center gap-5">
                  {readyPods.length === 0 && activePods.length === 0 && <span className="text-[10px] font-medium text-amber-600 font-geist-mono uppercase tracking-widest">No pods</span>}
                  <button onClick={handleSend} disabled={sending || !inputText.trim()} className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:bg-black transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed">
                    <Icon icon="solar:arrow-up-linear" width={20} height={20} />
                  </button>
                </div>
              </div>
            </div>
            <div className="text-center mt-3"><span className="text-[10px] font-medium text-neutral-400 font-geist-mono uppercase tracking-widest">cmd + enter to send</span></div>
          </div>
        </div>
      </main>

      {/* ── MOBILE NAV ── */}
      <nav className="md:hidden fixed bottom-0 w-full h-16 bg-white/80 backdrop-blur-md border-t border-neutral-200 flex items-center justify-around z-50 px-2 shadow-[0_-4px_24px_rgba(0,0,0,0.02)] pointer-events-auto">
        {["solar:home-angle-linear", "solar:chat-round-line-linear", "solar:play-circle-linear", "solar:safe-square-linear"].map((ic, i) => (
          <button key={ic} className={`flex flex-col items-center justify-center w-12 h-12 ${i === 0 ? "text-neutral-900 relative" : "text-neutral-400 hover:text-neutral-900"}`}>
            <Icon icon={ic} width={24} height={24} />
            {i === 0 && <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-neutral-900" />}
          </button>
        ))}
      </nav>
    </>
  );
}

// ─── Sub-components ───

function NavBtn({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <button className={`group grid place-items-center w-10 h-10 rounded-full transition-all relative cursor-pointer ${active ? "text-neutral-900 bg-neutral-100 shadow-sm border border-neutral-200/50" : "text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100/80"}`}>
      <Icon icon={icon} width={20} height={20} />
      <span className="absolute left-14 bg-neutral-900 text-white text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-geist-mono shadow-sm">{label}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = JOB_STATUS_CONFIG[status] || { label: status };
  const failed = isFailed(status);
  const done = status === "completed";
  return (
    <span className={`text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full ${
      done ? "bg-emerald-50 text-emerald-600" :
      failed ? "bg-red-50 text-red-600" :
      "bg-neutral-100 text-neutral-500"
    }`}>
      {cfg.label}
    </span>
  );
}

function JobRow({ job, active, onClick }: { job: DbJob; active: boolean; onClick: () => void }) {
  const running = isActive(job.status) && job.status !== "created";
  const failed = isFailed(job.status);
  const cfg = JOB_STATUS_CONFIG[job.status] || { label: job.status };

  return (
    <div onClick={onClick} className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all mb-1 ${active ? "bg-white shadow-sm border border-neutral-200/80" : "hover:bg-white/80 border border-transparent hover:border-neutral-200/50"}`}>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate transition-colors ${active ? "text-neutral-900" : "text-neutral-600 group-hover:text-neutral-900"}`}>
          {job.input_text?.slice(0, 50) || "Untitled job"}
        </div>
        <div className={`text-xs mt-1 font-geist-mono flex items-center gap-1.5 ${failed ? "text-red-400" : "text-neutral-400"}`}>
          {running && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative"><span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-40" /></span>}
          {cfg.label}
          {job.attempt > 1 && <span className="text-[10px] text-amber-500">·retry {job.attempt}</span>}
        </div>
      </div>
      <div className="text-xs text-neutral-400 shrink-0 font-geist-mono mt-0.5">{timeAgo(job.created_at)}</div>
    </div>
  );
}
