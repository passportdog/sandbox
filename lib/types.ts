export type RunStatus = "idle" | "running" | "failed" | "completed";

export interface Attachment {
  id: string;
  type: "image" | "pdf" | "json" | "text" | "other";
  filename: string;
  size: number;
  localRef: string;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  runStatus: RunStatus;
}

export type MessageRole = "user" | "assistant" | "tool" | "log" | "artifact";

export interface Message {
  id: string;
  threadId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  attachments: Attachment[];
}

export interface RunStep {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "failed";
}

export interface Run {
  id: string;
  threadId: string;
  status: Exclude<RunStatus, "idle">;
  startedAt: string;
  endedAt?: string;
  steps: RunStep[];
  logs: string[];
}

export interface AppState {
  threads: Thread[];
  messages: Message[];
  runs: Run[];
  settings: {
    apiKey: string;
    model: string;
    stream: boolean;
    theme: "light" | "dark";
  };
}
