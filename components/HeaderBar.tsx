"use client";

import { Icon } from "@iconify/react";
import { usePods } from "@/lib/hooks";
import { POD_STATUS_CONFIG } from "@/lib/db-types";

export function HeaderBar() {
  const { pods, createPod } = usePods();

  const activePods = pods.filter((p) => !["terminated", "stopped"].includes(p.status));
  const readyPods = pods.filter((p) => p.status === "ready");
  const primaryPod = readyPods[0] || activePods[0];
  const podCfg = primaryPod
    ? POD_STATUS_CONFIG[primaryPod.status] || { color: "bg-neutral-400", label: primaryPod.status }
    : null;

  // Extract the base color class (no animate-pulse etc.) for the dot
  const dotColor = podCfg?.color.split(" ")[0] || "bg-neutral-400";
  const isPulsing = podCfg?.color.includes("animate-pulse");

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-neutral-200/60">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white shadow-sm">
          <Icon icon="solar:box-minimalistic-linear" width={18} height={18} />
        </div>
        <span className="text-sm font-semibold text-neutral-900 tracking-tight">sandbox.fun</span>
      </div>

      {/* Pod status */}
      <div className="flex items-center gap-3">
        {activePods.length === 0 ? (
          <>
            <span className="hidden sm:block text-[10px] font-medium text-amber-600 font-geist-mono uppercase tracking-widest">
              No Pods
            </span>
            <button
              onClick={() => createPod({ gpu: "standard" })}
              className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors shadow-sm"
            >
              <Icon icon="solar:cpu-bolt-linear" width={14} height={14} />
              Launch Pod
            </button>
          </>
        ) : primaryPod && podCfg ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
            <span className="relative flex items-center justify-center w-2 h-2">
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor} block`} />
              {isPulsing && (
                <span className={`animate-ping absolute inset-0 rounded-full ${dotColor} opacity-40`} />
              )}
            </span>
            <span className="text-[11px] font-medium text-neutral-700 font-geist-mono">
              {podCfg.label}
            </span>
            {primaryPod.gpu_type && (
              <span className="hidden sm:block text-[10px] text-neutral-400 font-geist-mono">
                · {primaryPod.gpu_type}
              </span>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
