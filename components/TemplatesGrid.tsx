"use client";

import { Icon } from "@iconify/react";
import { useTemplates, useModels } from "@/lib/hooks";
import type { DbTemplate, DbModel } from "@/lib/db-types";

const CATEGORY_ICON: Record<string, string> = {
  txt2img:    "solar:pallete-2-linear",
  controlnet: "solar:layers-linear",
  upscale:    "solar:magnifer-zoom-in-linear",
  lora:       "solar:star-shine-linear",
};

const CATEGORY_COLOR: Record<string, string> = {
  txt2img:    "bg-blue-50 text-blue-600",
  controlnet: "bg-purple-50 text-purple-600",
  upscale:    "bg-cyan-50 text-cyan-600",
  lora:       "bg-indigo-50 text-indigo-600",
};

interface TemplatesGridProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function TemplatesGrid({ selectedId, onSelect }: TemplatesGridProps) {
  const { templates, loading } = useTemplates();
  const { models } = useModels();

  const cachedFilenames = new Set<string>(
    models.filter((m: DbModel) => m.is_cached).map((m: DbModel) => m.filename)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="solar:code-square-linear" width={16} height={16} className="text-neutral-400" />
          <span className="text-sm font-medium text-neutral-900">My Templates</span>
        </div>
        {templates.length > 0 && (
          <span className="text-[10px] font-geist-mono text-neutral-400">{templates.length} template{templates.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <Icon icon="solar:loading-linear" width={20} height={20} className="text-neutral-300 animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white/40 border border-dashed border-neutral-200 rounded-2xl h-32 flex flex-col items-center justify-center gap-2">
          <Icon icon="solar:code-square-linear" width={24} height={24} className="text-neutral-200" />
          <p className="text-sm text-neutral-400">No templates yet. Import a workflow above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.filter((t) => t.is_active).map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              cachedFilenames={cachedFilenames}
              selected={t.id === selectedId}
              onSelect={() => onSelect(t.id === selectedId ? null : t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  cachedFilenames,
  selected,
  onSelect,
}: {
  template: DbTemplate;
  cachedFilenames: Set<string>;
  selected: boolean;
  onSelect: () => void;
}) {
  const totalModels  = template.required_models?.length ?? 0;
  const cachedModels = template.required_models?.filter((f) => cachedFilenames.has(f)).length ?? 0;
  const allCached    = totalModels === 0 || cachedModels === totalModels;

  const catColor = CATEGORY_COLOR[template.category ?? ""] ?? "bg-neutral-100 text-neutral-500";
  const catIcon  = CATEGORY_ICON[template.category ?? ""] ?? "solar:code-square-linear";

  return (
    <div className={`bg-white/60 backdrop-blur-xl border rounded-2xl p-5 transition-all cursor-pointer group flex flex-col gap-4 ${
      selected
        ? "border-neutral-900 shadow-md ring-1 ring-neutral-900/5"
        : "border-neutral-200/60 hover:border-neutral-300 hover:shadow-lg"
    }`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-500 shrink-0 group-hover:scale-105 transition-transform">
          <Icon icon={catIcon} width={18} height={18} />
        </div>
        {allCached ? (
          <span className="text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" /> Ready
          </span>
        ) : (
          <span className="text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
            {cachedModels}/{totalModels} cached
          </span>
        )}
      </div>

      {/* Name + category */}
      <div className="flex-1">
        <p className="text-sm font-semibold text-neutral-900 leading-snug">{template.name}</p>
        {template.description && (
          <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">{template.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {template.category && (
            <span className={`text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full ${catColor}`}>
              {template.category}
            </span>
          )}
          {totalModels > 0 && (
            <span className="text-[10px] font-geist-mono text-neutral-400">
              {totalModels} model{totalModels !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={onSelect}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all ${
          selected
            ? "bg-neutral-900 text-white"
            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-900 hover:text-white"
        }`}
      >
        <Icon icon={selected ? "solar:close-circle-linear" : "solar:play-circle-linear"} width={14} height={14} />
        {selected ? "Close" : "Run ▶"}
      </button>
    </div>
  );
}
