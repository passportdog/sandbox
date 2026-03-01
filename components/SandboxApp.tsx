"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LeftRail } from "@/components/LeftRail";
import { ThreadList } from "@/components/ThreadList";
import { ChatPanel } from "@/components/ChatPanel";
import { AppState, Message } from "@/lib/types";
import { addMessage, completeRun, createRun, createThread, loadState, saveState, toAttachment } from "@/lib/mockStore";
import { uid } from "@/lib/utils";

interface SandboxAppProps {
  activeThreadId?: string;
}

const stylePrefix: Record<string, string> = {
  Default: "",
  Planner: "Provide a structured plan: ",
  Builder: "Focus on implementation details: ",
  Concise: "Respond concisely: ",
  "Spec Writer": "Write as a formal product spec: ",
};

export function SandboxApp({ activeThreadId }: SandboxAppProps) {
  const router = useRouter();
  const [state, setState] = useState<AppState | null>(null);
  const [search, setSearch] = useState("");
  const [composerText, setComposerText] = useState("");
  const [style, setStyle] = useState("Default");
  const [cite, setCite] = useState(false);
  const [attachments, setAttachments] = useState<Message["attachments"]>([]);

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    if (!state) return;
    saveState(state);
  }, [state]);

  const filteredThreads = useMemo(() => {
    if (!state) return [];
    return state.threads.filter((thread) => thread.title.toLowerCase().includes(search.toLowerCase()));
  }, [search, state]);

  const activeThread = useMemo(
    () => state?.threads.find((thread) => thread.id === activeThreadId),
    [activeThreadId, state],
  );

  const activeMessages = useMemo(
    () => (state ? state.messages.filter((message) => message.threadId === activeThreadId) : []),
    [activeThreadId, state],
  );

  const handleCreateThread = () => {
    if (!state) return;
    const next = structuredClone(state);
    const thread = createThread(next);
    setState(next);
    router.push(`/thread/${thread.id}`);
  };

  const handleSend = () => {
    if (!state || !activeThreadId || !composerText.trim()) return;

    const next = structuredClone(state);
    const finalPrompt = `${stylePrefix[style]}${composerText}`.trim();
    addMessage(next, {
      id: uid("msg"),
      threadId: activeThreadId,
      role: "user",
      content: finalPrompt,
      createdAt: new Date().toISOString(),
      attachments,
    });

    const run = createRun(next, activeThreadId);
    const assistantId = uid("msg");
    addMessage(next, {
      id: assistantId,
      threadId: activeThreadId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      attachments: [],
    });

    setState(next);
    setComposerText("");
    setAttachments([]);

    const response = `Here is a thoughtful draft for your request. I can expand this into actionable steps and implementation details.${
      cite ? "\n\n[Citations enabled: placeholder format]" : ""
    }`;

    let index = 0;
    const timer = window.setInterval(() => {
      setState((current) => {
        if (!current) return current;
        const copy = structuredClone(current);
        const target = copy.messages.find((message) => message.id === assistantId);
        if (!target) return current;
        target.content = response.slice(0, index + 1);
        if (index >= response.length - 1) {
          completeRun(copy, run.id);
          window.clearInterval(timer);
        }
        return copy;
      });
      index += 1;
    }, 18);
  };

  if (!state) return null;

  return (
    <AppShell
      leftRail={<LeftRail />}
      threadList={
        <ThreadList
          activeThreadId={activeThreadId}
          threads={filteredThreads}
          search={search}
          onSearch={setSearch}
          onCreateThread={handleCreateThread}
        />
      }
      main={
        <ChatPanel
          threadTitle={activeThread?.title}
          messages={activeMessages}
          composerText={composerText}
          onComposerText={setComposerText}
          onSend={handleSend}
          onQuickPrompt={setComposerText}
          style={style}
          onStyleChange={setStyle}
          cite={cite}
          onCiteChange={setCite}
          onAttach={(files) => {
            if (!files) return;
            setAttachments(Array.from(files).map(toAttachment));
          }}
          attachments={attachments}
          runStatus={activeThread?.runStatus}
          emptyState={!activeThreadId}
        />
      }
    />
  );
}
