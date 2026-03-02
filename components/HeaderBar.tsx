"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { usePods } from "@/lib/hooks";
import { POD_STATUS_CONFIG } from "@/lib/db-types";

export function HeaderBar() {
  const { pods, createPod, refetch } = usePods();

  // Background poll every 15s to sync RunPod status into DB
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    const interval = setInterval(async () => {
      await fetch("/api/pods/poll").catch(() => {});
      refetchRef.current();
    }, 15_000);
    return () => clearInterval(interval);
  }, []);

  const activePods = pods.filter((p) => !["terminated", "stopped"].includes(p.status));
  const readyPods  = pods.filter((p) => p.status === "ready");
  const primaryPod = readyPods[0] ?? activePods[0] ?? null;

  return (
    <div className="sticky top-0 z-50 w-full border-b border-neutral-200/60 bg-white/80 backdrop-blur-xl">
      <div className="max-w-[960px] mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center text-white">
            <Icon icon="solar:box-minimalistic-linear" width={16} height={16} />
          </div>
          <span className="text-sm font-semibold text-neutral-900">sandbox.fun</span>
        </div>

        {/* Pod status */}
        <div className="flex items-center gap-3">
          {!primaryPod ? (
            <>
              <span className="text-[10px] font-medium text-amber-600 font-geist-mono uppercase tracking-widest">
                No Pods
              </span>
              <button
                onClick={() => createPod({ gpu: "standard" })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors shadow-sm"
              >
                <Icon icon="solar:cpu-bolt-linear" width={13} height={13} />
                Launch Pod
              </button>
            </>
          ) : (
            <PodPill pod={primaryPod} />
          )}
        </div>
      </div>
    </div>
  );
}

function PodPill({ pod }: { pod: { status: string; gpu_type: string | null } }) {
  const cfg     = POD_STATUS_CONFIG[pod.status] ?? { label: pod.status, color: "bg-neutral-400" };
  const isReady = pod.status === "ready";
  const isPulse = ["creating", "bootstrapping", "running"].includes(pod.status);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-200/80 bg-white/80">
      <span className="relative flex h-2 w-2">
        <span className={`w-2 h-2 rounded-full ${isReady ? "bg-emerald-500" : isPulse ? "bg-amber-400" : "bg-neutral-400"}`} />
        {isPulse && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-50" />}
      </span>
      <span className="text-xs font-medium text-neutral-700 font-geist-mono">
        {cfg.label}
        {pod.gpu_type && <span className="text-neutral-400"> · {pod.gpu_type.replace("NVIDIA ", "")}</span>}
      </span>
    </div>
  );
}
