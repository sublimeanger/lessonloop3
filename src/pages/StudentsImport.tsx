import { Check, Upload, Wand2, Eye, PartyPopper } from "lucide-react";
import { usePageMeta } from '@/hooks/usePageMeta';
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStudentsImport } from "@/hooks/useStudentsImport";
import { UploadStep } from "@/components/students/import/UploadStep";
import { MappingStep } from "@/components/students/import/MappingStep";
import { PreviewStep } from "@/components/students/import/PreviewStep";
import { ImportingStep } from "@/components/students/import/ImportingStep";
import { CompleteStep } from "@/components/students/import/CompleteStep";

const STEPS = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "mapping", label: "Map Fields", icon: Wand2 },
  { key: "preview", label: "Preview", icon: Eye },
  { key: "complete", label: "Done", icon: PartyPopper },
] as const;

function getStepIndex(step: string) {
  if (step === "importing") return 2; // importing is between preview and complete
  return STEPS.findIndex(s => s.key === step);
}

export default function StudentsImport() {
  usePageMeta('Import Students | LessonLoop', 'Bulk import students from CSV');
  const hook = useStudentsImport();
  const currentIdx = getStepIndex(hook.step);

  return (
    <AppLayout>
      <PageHeader
        title="Import Students"
        description="Upload a CSV file to bulk import students, guardians, and lesson schedules"
        breadcrumbs={[
          { label: "Students", href: "/students" },
          { label: "Import" },
        ]}
      />

      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        {/* Step indicator */}
        <nav aria-label="Import progress" className="flex items-center justify-between gap-1 sm:gap-0">
          {STEPS.map((s, idx) => {
            const isCompleted = currentIdx > idx || hook.step === "complete";
            const isCurrent = currentIdx === idx;
            const Icon = s.icon;

            return (
              <div key={s.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div
                    className={`
                      flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium
                      transition-all duration-300
                      ${isCompleted
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : isCurrent
                          ? "bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground"
                      }
                    `}
                  >
                    {isCompleted && !isCurrent ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={`text-micro hidden sm:block transition-colors duration-200 ${
                      isCurrent ? "text-foreground font-semibold" :
                      isCompleted ? "text-primary" :
                      "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="relative mx-2 h-0.5 flex-1 bg-muted overflow-hidden rounded-full sm:mx-3">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-500 ease-out"
                      style={{ width: isCompleted ? "100%" : isCurrent ? "50%" : "0%" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Step content with fade animation */}
        <div className="animate-fade-in">
          {hook.step === "upload" && (
            <UploadStep
              isLoading={hook.isLoading}
              handleFileUpload={hook.handleFileUpload}
              sourceSoftware={hook.sourceSoftware}
              setSourceSoftware={hook.setSourceSoftware}
            />
          )}

          {hook.step === "mapping" && (
            <MappingStep
              headers={hook.headers}
              rows={hook.rows}
              mappings={hook.mappings}
              targetFields={hook.targetFields}
              warnings={hook.warnings}
              isLoading={hook.isLoading}
              requiredFieldsMapped={hook.requiredFieldsMapped}
              canProceedWithImport={hook.canProceedWithImport}
              willExceedLimit={hook.willExceedLimit}
              remainingCapacity={hook.remainingCapacity}
              counts={hook.counts}
              limits={hook.limits}
              teachers={hook.teachers}
              selectedTeacher={hook.selectedTeacher}
              setSelectedTeacher={hook.setSelectedTeacher}
              importLessons={hook.importLessons}
              setImportLessons={hook.setImportLessons}
              updateMapping={hook.updateMapping}
              getAvailableFields={hook.getAvailableFields}
              detectedSource={hook.detectedSource}
              onNext={hook.executeDryRun}
              onBack={() => hook.setStep("upload")}
            />
          )}

          {hook.step === "preview" && hook.dryRunResult && (
            <PreviewStep
              dryRunResult={hook.dryRunResult}
              previewTab={hook.previewTab}
              setPreviewTab={hook.setPreviewTab}
              transformedRows={hook.transformedRows}
              filteredRowStatuses={hook.filteredRowStatuses}
              skipDuplicates={hook.skipDuplicates}
              setSkipDuplicates={hook.setSkipDuplicates}
              isLoading={hook.isLoading}
              onExecute={hook.executeImport}
              onBack={() => hook.setStep("mapping")}
            />
          )}

          {hook.step === "importing" && <ImportingStep />}

          {hook.step === "complete" && hook.importResult && (
            <CompleteStep
              importResult={hook.importResult}
              downloadFailedRows={hook.downloadFailedRows}
              onImportMore={hook.resetImport}
              onViewStudents={() => hook.navigate("/students")}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
