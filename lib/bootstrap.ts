/**
 * Pod Bootstrap Script Generator
 *
 * Generates shell commands to run on a RunPod pod to download
 * required models and set up ComfyUI for workflow execution.
 */

export interface DownloadTask {
  url: string;
  filename: string;
  folder: string; // ComfyUI subfolder (checkpoints, loras, etc.)
  sizeMb?: number;
}

/**
 * Generate an aria2c download command for a model file.
 * aria2c is preferred over wget/curl for resumable multi-connection downloads.
 */
export function aria2cCommand(task: DownloadTask, comfyuiRoot: string = "/workspace/ComfyUI"): string {
  const dir = `${comfyuiRoot}/models/${task.folder}`;
  return [
    `aria2c`,
    `--dir="${dir}"`,
    `--out="${task.filename}"`,
    `--max-connection-per-server=4`,
    `--split=4`,
    `--continue=true`,
    `--auto-file-renaming=false`,
    `--allow-overwrite=true`,
    `--console-log-level=warn`,
    `--summary-interval=10`,
    `"${task.url}"`,
  ].join(" ");
}

/**
 * Generate the full bootstrap script for a pod.
 * Includes health check, model downloads, and ComfyUI restart if needed.
 */
export function generateBootstrapScript(
  tasks: DownloadTask[],
  opts: {
    comfyuiRoot?: string;
    restartComfyui?: boolean;
  } = {}
): string {
  const root = opts.comfyuiRoot ?? "/workspace/ComfyUI";
  const lines: string[] = [
    "#!/bin/bash",
    "set -e",
    "",
    "# ── Sandbox.fun Pod Bootstrap ──",
    `echo "[bootstrap] Starting at $(date)"`,
    "",
    "# Ensure model directories exist",
  ];

  const folders = [...new Set(tasks.map((t) => t.folder))];
  for (const folder of folders) {
    lines.push(`mkdir -p "${root}/models/${folder}"`);
  }

  if (tasks.length > 0) {
    lines.push("");
    lines.push("# ── Download models ──");

    for (const task of tasks) {
      lines.push("");
      lines.push(`echo "[bootstrap] Downloading ${task.filename} → ${task.folder}/"${task.sizeMb ? ` (${task.sizeMb}MB)` : ""}`);
      lines.push(`if [ ! -f "${root}/models/${task.folder}/${task.filename}" ]; then`);
      lines.push(`  ${aria2cCommand(task, root)}`);
      lines.push(`else`);
      lines.push(`  echo "[bootstrap] ${task.filename} already exists, skipping"`);
      lines.push(`fi`);
    }
  }

  if (opts.restartComfyui) {
    lines.push("");
    lines.push("# ── Restart ComfyUI to pick up new models ──");
    lines.push(`echo "[bootstrap] Restarting ComfyUI..."`);
    lines.push(`pkill -f "python.*main.py" || true`);
    lines.push(`sleep 2`);
    lines.push(`cd "${root}" && nohup python main.py --listen 0.0.0.0 --port 8188 > /workspace/comfyui.log 2>&1 &`);
    lines.push(`echo "[bootstrap] ComfyUI restarted, waiting for health..."`);
    lines.push(`for i in $(seq 1 30); do`);
    lines.push(`  if curl -s http://127.0.0.1:8188/system_stats > /dev/null 2>&1; then`);
    lines.push(`    echo "[bootstrap] ComfyUI healthy after ${"{"}i${"}"}s"`);
    lines.push(`    break`);
    lines.push(`  fi`);
    lines.push(`  sleep 1`);
    lines.push(`done`);
  }

  lines.push("");
  lines.push(`echo "[bootstrap] Done at $(date)"`);

  return lines.join("\n");
}
