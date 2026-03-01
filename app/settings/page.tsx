"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadState, saveState } from "@/lib/mockStore";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openrouter/anthropic/claude-3.5-sonnet");
  const [stream, setStream] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const state = loadState();
    setApiKey(state.settings.apiKey);
    setModel(state.settings.model);
    setStream(state.settings.stream);
    setTheme(state.settings.theme);
  }, []);

  const save = () => {
    const state = loadState();
    state.settings = { apiKey, model, stream, theme };
    saveState(state);
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-14">
      <Link href="/" className="mb-6 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Back to sandbox
      </Link>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Configure your local OpenRouter preferences.</p>

      <div className="mt-8 space-y-4 rounded-card border border-border bg-white p-6 shadow-soft">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">OpenRouter API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2"
            placeholder="sk-or-v1-..."
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Default Model</span>
          <select value={model} onChange={(event) => setModel(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2">
            <option value="openrouter/anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
            <option value="openrouter/openai/gpt-4o-mini">GPT-4o Mini</option>
          </select>
        </label>

        <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
          Stream responses
          <input type="checkbox" checked={stream} onChange={(event) => setStream(event.target.checked)} />
        </label>

        <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
          Dark theme
          <input type="checkbox" checked={theme === "dark"} onChange={(event) => setTheme(event.target.checked ? "dark" : "light")} />
        </label>

        <button onClick={save} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Save settings
        </button>
      </div>
    </div>
  );
}
