"use client";

import Link from "next/link";
import { useMemo } from "react";
import { loadState } from "@/lib/mockStore";

export default function RunDetailPage({ params }: { params: { id: string } }) {
  const run = useMemo(() => loadState().runs.find((item) => item.id === params.id), [params.id]);

  if (!run) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <p className="mb-4 text-sm text-slate-500">Run not found.</p>
        <Link href="/" className="text-sm underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Run {run.id}</h1>
      <p className="text-sm text-slate-500">Status: {run.status}</p>
      <div className="mt-4 space-y-2 rounded-card border border-border bg-white p-4">
        {run.steps.map((step) => (
          <div key={step.id} className="flex items-center justify-between text-sm">
            <span>{step.title}</span>
            <span className="text-slate-500">{step.status}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-card border border-border bg-slate-50 p-4 font-mono text-xs">
        {run.logs.map((log, index) => (
          <p key={`${log}-${index}`}>{log}</p>
        ))}
      </div>
    </div>
  );
}
