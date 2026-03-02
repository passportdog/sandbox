// OpenRouter API Client
// Used for the planning agent

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");
  return key;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<string> {
  const {
    model = "anthropic/claude-sonnet-4-20250514",
    temperature = 0.3,
    maxTokens = 4096,
    responseFormat,
  } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://sandbox.fun",
      "X-Title": "sandbox.fun",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content || "";
}

/** Planning agent: turn natural language into a structured execution plan */
export async function planJob(
  userInput: string,
  availableTemplates: { slug: string; name: string; description: string; category: string }[],
  availableModels: { name: string; filename: string; target_folder: string }[]
): Promise<{
  template_slug: string;
  params: Record<string, unknown>;
  models_needed: { source: string; query: string; target: string }[];
  reasoning: string;
}> {
  const systemPrompt = `You are a ComfyUI workflow planning agent for sandbox.fun.

Given a user's generation request, produce a JSON execution plan.

Available workflow templates:
${availableTemplates.map((t) => `- ${t.slug}: ${t.name} (${t.category}) — ${t.description}`).join("\n")}

Available cached models:
${availableModels.length > 0 ? availableModels.map((m) => `- ${m.filename} (${m.target_folder})`).join("\n") : "None cached yet"}

Respond with ONLY valid JSON matching this schema:
{
  "template_slug": "string — which template to use",
  "params": {
    "prompt": "string — the positive prompt for generation",
    "negative_prompt": "string — negative prompt",
    "steps": "number — inference steps (default 25)",
    "cfg": "number — classifier free guidance (default 7)",
    "width": "number — image width",
    "height": "number — image height",
    "seed": "number — random seed (-1 for random)"
  },
  "models_needed": [
    { "source": "civitai|huggingface", "query": "search term or model ID", "target": "checkpoints|loras|controlnet|vae" }
  ],
  "reasoning": "string — brief explanation of your choices"
}

If the user doesn't specify a model, use the default checkpoint for the template.
If the user asks for something the templates can't do, pick the closest match and explain in reasoning.`;

  const response = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput },
    ],
    { temperature: 0.2, responseFormat: { type: "json_object" } }
  );

  try {
    return JSON.parse(response);
  } catch {
    throw new Error(`Failed to parse plan: ${response}`);
  }
}
