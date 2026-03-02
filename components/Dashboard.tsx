"use client";

import { useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { HeaderBar } from "@/components/HeaderBar";
import { ImportPanel } from "@/components/ImportPanel";
import { ImportReportCard } from "@/components/ImportReportCard";
import { TemplatesGrid } from "@/components/TemplatesGrid";
import { TemplateRunPanel } from "@/components/TemplateRunPanel";
import { JobsSection } from "@/components/JobsSection";
import { ModelsSection } from "@/components/ModelsSection";
import type { ImportReport } from "@/components/ImportPanel";

export function Dashboard() {
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [importReport, setImportReport]     = useState<ImportReport | null>(null);

  return (
    <>
      <AmbientBackground />

      <div className="relative z-10 min-h-screen flex flex-col">
        <HeaderBar />

        <div className="flex-1 max-w-[960px] w-full mx-auto px-6 py-8 space-y-8 pb-16">
          {/* ① Import Anything */}
          <ImportPanel onReport={(r) => { setImportReport(r); }} />

          {/* ② Analysis result */}
          {importReport && (
            <ImportReportCard
              report={importReport}
              onDismiss={() => setImportReport(null)}
            />
          )}

          {/* ③ Templates */}
          <TemplatesGrid
            selectedId={activeTemplate}
            onSelect={setActiveTemplate}
          />

          {/* ④ Run panel (shown when a template is selected) */}
          {activeTemplate && (
            <TemplateRunPanel
              templateId={activeTemplate}
              onClose={() => setActiveTemplate(null)}
            />
          )}

          {/* ⑤ Jobs */}
          <JobsSection />

          {/* ⑥ Model registry */}
          <ModelsSection />
        </div>
      </div>
    </>
  );
}
