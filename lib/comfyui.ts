// ComfyUI Remote API Client
// Communicates with a ComfyUI instance over HTTP

export interface ComfyPromptResponse {
  prompt_id: string;
  number: number;
  node_errors: Record<string, unknown>;
}

export interface ComfyHistoryEntry {
  prompt: [number, string, Record<string, unknown>, Record<string, string[]>, string[]];
  outputs: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>;
  status: { status_str: string; completed: boolean; messages: unknown[] };
}

export class ComfyClient {
  constructor(private baseUrl: string) {}

  private async request(path: string, options?: RequestInit) {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ComfyUI ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  /** Check if ComfyUI is alive */
  async health(): Promise<boolean> {
    try {
      await this.request("/system_stats");
      return true;
    } catch {
      return false;
    }
  }

  /** Get system stats */
  async systemStats(): Promise<Record<string, unknown>> {
    return this.request("/system_stats");
  }

  /** Get all installed node types and their info */
  async objectInfo(): Promise<Record<string, unknown>> {
    return this.request("/object_info");
  }

  /** Queue a workflow prompt */
  async queuePrompt(workflow: Record<string, unknown>): Promise<ComfyPromptResponse> {
    return this.request("/prompt", {
      method: "POST",
      body: JSON.stringify({ prompt: workflow }),
    });
  }

  /** Get execution history for a prompt */
  async getHistory(promptId: string): Promise<Record<string, ComfyHistoryEntry>> {
    return this.request(`/history/${promptId}`);
  }

  /** Get the current queue */
  async getQueue(): Promise<{ queue_running: unknown[]; queue_pending: unknown[] }> {
    return this.request("/queue");
  }

  /** Get an output image as a blob URL */
  imageUrl(filename: string, subfolder: string = "", type: string = "output"): string {
    return `${this.baseUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${type}`;
  }

  /** Upload an image for use as input */
  async uploadImage(file: Blob, filename: string, subfolder: string = ""): Promise<{ name: string; subfolder: string; type: string }> {
    const form = new FormData();
    form.append("image", file, filename);
    if (subfolder) form.append("subfolder", subfolder);
    form.append("overwrite", "true");

    const res = await fetch(`${this.baseUrl}/upload/image`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  }

  /** Poll history until prompt completes or times out */
  async waitForCompletion(promptId: string, timeoutMs: number = 300000, pollMs: number = 2000): Promise<ComfyHistoryEntry> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const history = await this.getHistory(promptId);
      const entry = history[promptId];
      if (entry?.status?.completed) return entry;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(`Prompt ${promptId} timed out after ${timeoutMs}ms`);
  }
}

/** Apply parameter overrides to a workflow template */
export function patchWorkflow(
  template: Record<string, unknown>,
  paramSchema: Record<string, { node: string; field: string }>,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  const workflow = structuredClone(template);

  for (const [paramName, value] of Object.entries(overrides)) {
    const schema = paramSchema[paramName];
    if (!schema) continue;

    const node = workflow[schema.node] as Record<string, unknown> | undefined;
    if (!node) continue;

    // Navigate nested field path like "inputs.text"
    const parts = schema.field.split(".");
    let target: Record<string, unknown> = node;
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]] as Record<string, unknown>;
      if (!target) break;
    }
    if (target) {
      target[parts[parts.length - 1]] = value;
    }
  }

  return workflow;
}
