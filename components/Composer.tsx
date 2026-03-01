"use client";

import { Attachment, Message } from "@/lib/types";
import { Paperclip, Send } from "lucide-react";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  style: string;
  onStyleChange: (style: string) => void;
  cite: boolean;
  onCiteChange: (value: boolean) => void;
  attachments: Attachment[];
  onAttach: (files: FileList | null) => void;
}

const styles = ["Default", "Planner", "Builder", "Concise", "Spec Writer"];

export function Composer({
  value,
  onChange,
  onSend,
  style,
  onStyleChange,
  cite,
  onCiteChange,
  attachments,
  onAttach,
}: ComposerProps) {
  return (
    <div className="rounded-card border border-border bg-white p-3 shadow-soft">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <span key={attachment.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {attachment.filename}
            </span>
          ))}
        </div>
      )}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onSend();
          }
        }}
        className="h-24 w-full resize-none rounded-xl border border-border px-3 py-2 text-sm outline-none ring-accent/30 focus:ring"
        placeholder="Type your request..."
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer rounded-xl border border-border px-3 py-2 text-xs hover:bg-slate-50">
            <span className="inline-flex items-center gap-1">
              <Paperclip className="size-3" /> Attach
            </span>
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.json,.txt"
              onChange={(event) => onAttach(event.target.files)}
              className="hidden"
            />
          </label>
          <select
            value={style}
            onChange={(event) => onStyleChange(event.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-xs outline-none"
          >
            {styles.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <input type="checkbox" checked={cite} onChange={(event) => onCiteChange(event.target.checked)} /> Citation
          </label>
          <button
            onClick={onSend}
            className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-medium text-white"
          >
            Send <Send className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
