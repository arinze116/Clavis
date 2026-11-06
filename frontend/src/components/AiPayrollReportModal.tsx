import { Check, Clipboard, FileText, LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { AnomalyEntry, AuditEntry, Recipient } from "../types";
import { generatePayrollReport } from "../utils/nearAi";
import { Modal } from "./Modal";

export function AiPayrollReportModal({
  contractId,
  auditEntries,
  anomalies,
  recipients,
  treasuryBalance,
  dailySpent,
  onClose,
}: {
  contractId: string;
  auditEntries: AuditEntry[];
  anomalies: AnomalyEntry[];
  recipients: Recipient[];
  treasuryBalance: string;
  dailySpent: string;
  onClose: () => void;
}) {
  const [report, setReport] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const result = await generatePayrollReport({
        contractId,
        auditEntries: auditEntries.slice(0, 100),
        anomalies: anomalies.slice(0, 30),
        recipients,
        treasuryBalance,
        dailySpent,
      });
      setReport(result.text);
      setModelLabel(result.modelLabel);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to generate the payroll report");
    } finally {
      setLoading(false);
    }
  }, [anomalies, auditEntries, contractId, dailySpent, recipients, treasuryBalance]);

  useEffect(() => {
    void generate();
  }, [generate]);

  async function copyReport() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError("Your browser could not copy the report. Select the text and copy it manually.");
    }
  }

  return (
    <Modal
      title="AI payroll control report"
      description="A CFO-style summary of the latest 30 privacy-safe audit decisions and anomaly signals."
      onClose={onClose}
      size="lg"
    >
      {loading && (
        <div className="animate-pulse space-y-4" aria-label="Generating payroll report">
          <div className="h-5 w-48 rounded bg-ink/10" />
          <div className="h-20 rounded-[12px] bg-white" />
          <div className="h-28 rounded-[12px] bg-white" />
          <div className="h-24 rounded-[12px] bg-white" />
          <p className="flex items-center gap-2 text-sm text-ink/50">
            <LoaderCircle className="h-4 w-4 animate-spin" /> NEAR AI is reviewing the ledger
          </p>
        </div>
      )}

      {!loading && error && !report && (
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-5">
          <p className="text-sm leading-6 text-red-800" role="alert">{error}</p>
          <button type="button" className="button-secondary mt-4" onClick={() => void generate()}>
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      )}

      {report && (
        <>
          <div className="rounded-[14px] border border-line bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3 border-b border-line pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-ink text-acid">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Clavis payroll controls</p>
                <p className="mt-1 font-mono text-[10px] text-ink/40">{contractId}</p>
                {modelLabel && (
                  <p className="mt-1 text-[11px] text-ink/40">
                    Powered by NEAR AI — {modelLabel}
                  </p>
                )}
              </div>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-ink/70">{report}</div>
          </div>
          {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="button-secondary" onClick={() => void generate()}>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </button>
            <button type="button" className="button-primary" onClick={() => void copyReport()}>
              {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              {copied ? "Copied" : "Copy report"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
