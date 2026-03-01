"use client";

import { Message, RunStatus } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";
import { Composer } from "@/components/Composer";
import { QuickStartTiles } from "@/components/QuickStartTiles";

interface ChatPanelProps {
  threadTitle?: string;
  messages: Message[];
  composerText: string;
  onComposerText: (value: string) => void;
  onSend: () => void;
  onQuickPrompt: (prompt: string) => void;
  style: string;
  onStyleChange: (style: string) => void;
  cite: boolean;
  onCiteChange: (value: boolean) => void;
  onAttach: (files: FileList | null) => void;
  attachments: Message["attachments"];
  runStatus?: RunStatus;
  emptyState: boolean;
}

export function ChatPanel({
  threadTitle,
  messages,
  composerText,
  onComposerText,
  onSend,
  onQuickPrompt,
  style,
  onStyleChange,
  cite,
  onCiteChange,
  onAttach,
  attachments,
  runStatus,
  emptyState,
}: ChatPanelProps) {
  return (
    <div className="flex h-screen w-full flex-col px-4 py-4 sm:px-8">
      <div className="mb-4 flex items-center justify-end gap-2">
        <select className="rounded-xl border border-border bg-white px-3 py-2 text-xs">
          <option>OpenRouter / Claude 3.5 Sonnet</option>
          <option>OpenRouter / GPT-4o</option>
        </select>
        <button className="rounded-xl border border-border bg-white px-3 py-2 text-xs">•••</button>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        {emptyState ? (
          <div className="my-auto">
            <h1 className="text-center text-4xl font-semibold tracking-tight">Good Afternoon, Jason</h1>
            <p className="mt-2 text-center text-slate-500">What&apos;s on your mind?</p>
            <div className="mt-8">
              <Composer
                value={composerText}
                onChange={onComposerText}
                onSend={onSend}
                style={style}
                onStyleChange={onStyleChange}
                cite={cite}
                onCiteChange={onCiteChange}
                onAttach={onAttach}
                attachments={attachments}
              />
              <QuickStartTiles onPick={onQuickPrompt} />
            </div>
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">{threadTitle}</h2>
            {runStatus === "running" && (
              <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                <span className="size-2 animate-pulse rounded-full bg-amber-400" /> Running...
              </span>
            )}
            <div className="space-y-3 overflow-y-auto pb-6 pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm ${
                    message.role === "user"
                      ? "ml-auto border-accent/20 bg-accent/10"
                      : message.role === "log"
                        ? "font-mono border-slate-200 bg-slate-50 text-xs"
                        : "border-border bg-white"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.attachments.map((attachment) => (
                        <span key={attachment.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                          {attachment.filename}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">
                    {message.role} • {formatRelativeTime(message.createdAt)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-auto pb-2">
              <Composer
                value={composerText}
                onChange={onComposerText}
                onSend={onSend}
                style={style}
                onStyleChange={onStyleChange}
                cite={cite}
                onCiteChange={onCiteChange}
                onAttach={onAttach}
                attachments={attachments}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
