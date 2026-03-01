"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Thread } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

interface ThreadListProps {
  activeThreadId?: string;
  threads: Thread[];
  search: string;
  onSearch: (query: string) => void;
  onCreateThread: () => void;
}

export function ThreadList({ activeThreadId, threads, search, onSearch, onCreateThread }: ThreadListProps) {
  return (
    <section className="flex h-screen flex-col px-4 py-4">
      <div className="mb-4 space-y-3">
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search thread"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-accent/30 transition focus:ring"
        />
        <button
          onClick={onCreateThread}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          <Plus className="size-4" />
          New Thread
        </button>
      </div>

      <div className="space-y-2 overflow-y-auto pb-4">
        {threads.map((thread) => (
          <Link
            key={thread.id}
            href={`/thread/${thread.id}`}
            className={`block rounded-xl border p-3 transition ${
              thread.id === activeThreadId ? "border-slate-300 bg-slate-50" : "border-transparent hover:border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-medium">{thread.title}</p>
              <span
                className={`mt-1 inline-block size-2 rounded-full ${
                  thread.runStatus === "running"
                    ? "bg-amber-400"
                    : thread.runStatus === "failed"
                      ? "bg-red-400"
                      : "bg-emerald-400"
                }`}
              />
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{thread.lastMessagePreview || "No messages yet"}</p>
            <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(thread.updatedAt)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
