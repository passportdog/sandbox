import { AppState, Attachment, Message, Run, Thread } from "@/lib/types";
import { uid } from "@/lib/utils";

const STORAGE_KEY = "sandbox-fun-state-v1";

const now = new Date();
const seededThreadId = uid("thread");

const defaultState: AppState = {
  threads: [
    {
      id: seededThreadId,
      title: "Welcome to sandbox.fun",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastMessagePreview: "Ask anything to begin.",
      runStatus: "idle",
    },
  ],
  messages: [
    {
      id: uid("msg"),
      threadId: seededThreadId,
      role: "assistant",
      content: "Welcome! Start a new thread or ask me to draft a plan.",
      createdAt: now.toISOString(),
      attachments: [],
    },
  ],
  runs: [],
  settings: {
    apiKey: "",
    model: "openrouter/anthropic/claude-3.5-sonnet",
    stream: true,
    theme: "light",
  },
};

export const loadState = (): AppState => {
  if (typeof window === "undefined") return defaultState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState;
  try {
    return JSON.parse(raw) as AppState;
  } catch {
    return defaultState;
  }
};

export const saveState = (state: AppState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const createThread = (state: AppState): Thread => {
  const timestamp = new Date().toISOString();
  const thread: Thread = {
    id: uid("thread"),
    title: "Untitled Thread",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessagePreview: "",
    runStatus: "idle",
  };
  state.threads = [thread, ...state.threads];
  return thread;
};

export const addMessage = (state: AppState, message: Message) => {
  state.messages.push(message);
  const thread = state.threads.find((item) => item.id === message.threadId);
  if (!thread) return;
  thread.updatedAt = message.createdAt;
  thread.lastMessagePreview = message.content;
  if (thread.title === "Untitled Thread" && message.role === "user") {
    thread.title = message.content.slice(0, 40);
  }
};

export const createRun = (state: AppState, threadId: string): Run => {
  const run: Run = {
    id: uid("run"),
    threadId,
    status: "running",
    startedAt: new Date().toISOString(),
    steps: [
      { id: uid("step"), title: "Analyze prompt", status: "running" },
      { id: uid("step"), title: "Draft response", status: "pending" },
    ],
    logs: ["Run started"],
  };

  state.runs = [run, ...state.runs];
  const thread = state.threads.find((item) => item.id === threadId);
  if (thread) thread.runStatus = "running";
  return run;
};

export const completeRun = (state: AppState, runId: string) => {
  const run = state.runs.find((item) => item.id === runId);
  if (!run) return;
  run.status = "completed";
  run.endedAt = new Date().toISOString();
  run.steps = run.steps.map((step, index) => ({
    ...step,
    status: index === 0 ? "done" : "done",
  }));
  run.logs.push("Run completed");
  const thread = state.threads.find((item) => item.id === run.threadId);
  if (thread) thread.runStatus = "idle";
};

export const toAttachment = (file: File): Attachment => ({
  id: uid("att"),
  type: file.type.includes("image")
    ? "image"
    : file.type.includes("pdf")
      ? "pdf"
      : file.type.includes("json")
        ? "json"
        : file.type.includes("text")
          ? "text"
          : "other",
  filename: file.name,
  size: file.size,
  localRef: URL.createObjectURL(file),
});
