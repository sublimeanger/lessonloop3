import { Check } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStudentsImport } from "@/hooks/useStudentsImport";
import { UploadStep } from "@/components/students/import/UploadStep";
import { MappingStep } from "@/components/students/import/MappingStep";
import { PreviewStep } from "@/components/students/import/PreviewStep";
import { ImportingStep } from "@/components/students/import/ImportingStep";
import { CompleteStep } from "@/components/students/import/CompleteStep";

export default function StudentsImport() {
  const hook = useStudentsImport();

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

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 text-sm">
          {["upload", "mapping", "preview", "complete"].map((s, idx) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                hook.step === s ? "bg-primary text-primary-foreground" :
                (hook.step === "importing" && s === "preview") ? "bg-primary text-primary-foreground" :
                ["upload", "mapping", "preview", "complete"].indexOf(hook.step) > idx ? "bg-primary/20 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {["upload", "mapping", "preview"].indexOf(hook.step) > idx || hook.step === "complete" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
              {idx < 3 && (
                <div className={`w-12 h-0.5 mx-1 ${
                  ["upload", "mapping", "preview", "complete"].indexOf(hook.step) > idx ? "bg-primary" : "bg-muted"
                }`} />
              )}
            </div>
          ))}
        </div>

        {hook.step === "upload" && (
          <UploadStep isLoading={hook.isLoading} handleFileUpload={hook.handleFileUpload} />
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
    </AppLayout>
  );
}
