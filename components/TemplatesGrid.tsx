"use client";

import { Icon } from "@iconify/react";
import { useTemplates } from "@/lib/hooks";

const CATEGORY_CONFIG: Record<string, { color: string; icon: string }> = {
  txt2img:    { color: "bg-blue-50 text-blue-600",   icon: "solar:palette-linear" },
  controlnet: { color: "bg-purple-50 text-purple-600", icon: "solar:code-scan-linear" },
  upscale:    { color: "bg-amber-50 text-amber-600",  icon: "solar:maximize-square-2-linear" },
  lora:       { color: "bg-pink-50 text-pink-600",    icon: "solar:layers-linear" },
};

const DEFAULT_CATEGORY = { color: "bg-neutral-100 text-neutral-500", icon: "solar:box-minimalistic-linear" };

interface TemplatesGridProps {
  onSelect: (templateId: string) => void;
  selectedId: string | null;
}

export function TemplatesGrid({ onSelect, selectedId }: TemplatesGridProps) {
  const { templates, loading } = useTemplates();

  const activeTemplates = templates.filter((t) => t.is_active);

  return (
    <div>
      <h2 className="text-sm font-medium text-neutral-900 mb-4">My Templates</h2>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/40 border border-neutral-200/60 rounded-2xl p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : activeTemplates.length === 0 ? (
        <div className="bg-white/40 backdrop-blur-xl border border-neutral-200/60 rounded-2xl p-10 text-center">
          <Icon icon="solar:layers-linear" width={32} height={32} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">No templates yet. Import a workflow above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTemplates.map((template) => {
            const catCfg = CATEGORY_CONFIG[template.category || ""] || DEFAULT_CATEGORY;
            const isSelected = template.id === selectedId;
            const requiredCount = template.required_models.length;

            return (
              <div
                key={template.id}
                className={`bg-white/60 backdrop-blur-xl border rounded-2xl p-5 transition-all group cursor-pointer ${
                  isSelected
                    ? "border-neutral-400 shadow-md bg-white/80"
                    : "border-neutral-200/60 hover:shadow-lg hover:border-neutral-300/80"
                }`}
                onClick={() => onSelect(template.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isSelected ? "bg-neutral-200" : "bg-neutral-100 group-hover:bg-neutral-200"}`}>
                    <Icon icon={catCfg.icon} width={16} height={16} className="text-neutral-600" />
                  </div>
                  <span className={`text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full ${catCfg.color}`}>
                    {template.category || "workflow"}
                  </span>
                </div>

                <h3 className="text-sm font-medium text-neutral-900 mb-1 leading-tight">{template.name}</h3>
                {template.description && (
                  <p className="text-xs text-neutral-500 font-geist-mono mb-3 line-clamp-2 leading-relaxed">
                    {template.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                  <span className="text-[10px] text-neutral-400 font-geist-mono">
                    {requiredCount} model{requiredCount !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(template.id); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm ${
                      isSelected
                        ? "bg-neutral-700 text-white hover:bg-neutral-600"
                        : "bg-neutral-900 text-white hover:bg-neutral-800"
                    }`}
                  >
                    <Icon icon={isSelected ? "solar:close-circle-linear" : "solar:play-circle-linear"} width={14} height={14} />
                    {isSelected ? "Close" : "Run"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
