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
import type { ImportReport } from "@/lib/import-types";

export function Dashboard() {
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  const handleTemplateSelect = (id: string) => {
    setActiveTemplate((prev) => (prev === id ? null : id));
  };

  const handleImportReport = (report: ImportReport) => {
    setImportReport(report);
    setTimeout(() => {
      document.getElementById("import-report")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <>
      {/* Fixed animated background — stays behind content as page scrolls */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <AmbientBackground />
      </div>

      {/* Scrollable page */}
      <div className="relative z-10 min-h-screen">
        <HeaderBar />

        <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
          {/* Hero: Import Panel */}
          <ImportPanel onReport={handleImportReport} />

          {/* Import analysis results */}
          {importReport && (
            <div id="import-report">
              <ImportReportCard report={importReport} />
            </div>
          )}

          {/* Templates grid */}
          <TemplatesGrid onSelect={handleTemplateSelect} selectedId={activeTemplate} />

          {/* Inline run panel — appears when a template is selected */}
          {activeTemplate && <TemplateRunPanel templateId={activeTemplate} />}

          {/* Active jobs + history */}
          <JobsSection />

          {/* Models registry (collapsible) */}
          <ModelsSection />
        </div>
      </div>
    </>
  );
}
