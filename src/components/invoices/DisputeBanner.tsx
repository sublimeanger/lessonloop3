import { AlertTriangle, ExternalLink, Info, CheckCircle2, XCircle } from "lucide-react";
import { parseISO, differenceInHours, differenceInDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useInvoiceDisputes, type PaymentDispute, isDisputeActive } from "@/hooks/useInvoiceDisputes";
import { formatCurrencyMinor, formatDateUK } from "@/lib/utils";

interface DisputeBannerProps {
  invoiceId: string;
  currency: string;
}

function formatDeadline(due: string | null): string {
  if (!due) return "no deadline set";
  const deadline = parseISO(due);
  const hoursRemaining = differenceInHours(deadline, new Date());
  if (hoursRemaining < 0) return "OVERDUE";
  if (hoursRemaining < 48) return `${hoursRemaining}h remaining`;
  const days = differenceInDays(deadline, new Date());
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}

function DisputeRow({ dispute, currency }: { dispute: PaymentDispute; currency: string }) {
  const active = isDisputeActive(dispute);
  const outcome = dispute.outcome;

  const isNeedsResponse =
    dispute.status === "needs_response" || dispute.status === "warning_needs_response";
  const isUnderReview =
    dispute.status === "under_review" || dispute.status === "warning_under_review";

  let tone: "urgent" | "active" | "won" | "lost" | "closed";
  if (active && isNeedsResponse) tone = "urgent";
  else if (active && isUnderReview) tone = "active";
  else if (outcome === "won") tone = "won";
  else if (outcome === "lost") tone = "lost";
  else tone = "closed";

  const cardClasses = {
    urgent: "border-red-400 bg-red-50/80 dark:border-red-700/70 dark:bg-red-950/40",
    active: "border-amber-300 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/30",
    won: "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/30",
    lost: "border-red-500 bg-red-50/80 dark:border-red-800/80 dark:bg-red-950/40",
    closed: "border-slate-300 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-950/30",
  }[tone];

  const iconMap = {
    urgent: <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />,
    active: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />,
    won: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />,
    lost: <XCircle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />,
    closed: <Info className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />,
  };

  const headings = {
    urgent: "Chargeback — evidence required",
    active: "Chargeback under review",
    won: "Chargeback resolved in your favour",
    lost: "Chargeback lost — funds reversed",
    closed: "Dispute closed",
  };

  const summaryFor = (t: typeof tone): string => {
    const amount = formatCurrencyMinor(dispute.amount_minor, currency);
    const reason = dispute.reason.replace(/_/g, " ");
    switch (t) {
      case "urgent":
        return `The cardholder has disputed ${amount} citing "${reason}". Submit evidence via Stripe before the deadline or the dispute defaults to lost.`;
      case "active":
        return `Evidence has been submitted for a ${amount} dispute. Stripe is reviewing; no further action is needed right now.`;
      case "won":
        return `The ${amount} dispute was resolved in your favour. Funds remain with you.`;
      case "lost":
        return `The ${amount} dispute was resolved against you. A compensating refund has been recorded automatically — the invoice now shows the amount as outstanding.`;
      case "closed":
        return `The ${amount} dispute has closed. Outcome: ${dispute.outcome ?? dispute.status}.`;
    }
  };

  return (
    <Card className={cardClasses}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {iconMap[tone]}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <p className="font-medium text-sm">{headings[tone]}</p>
                {tone === "urgent" && dispute.evidence_due_by && (
                  <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                    {formatDeadline(dispute.evidence_due_by)}
                  </span>
                )}
              </div>
              <p className="text-xs mt-1 opacity-90">{summaryFor(tone)}</p>
              {dispute.evidence_due_by && tone === "urgent" && (
                <p className="text-xs mt-1 opacity-75">
                  Deadline: {formatDateUK(parseISO(dispute.evidence_due_by), "dd MMM yyyy HH:mm")}
                </p>
              )}
            </div>
            {dispute.stripe_dashboard_url && (tone === "urgent" || tone === "active") && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="gap-1.5"
              >
                <a href={dispute.stripe_dashboard_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Stripe dashboard
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DisputeBanner({ invoiceId, currency }: DisputeBannerProps) {
  const { data: disputes, isLoading } = useInvoiceDisputes(invoiceId);

  if (isLoading || !disputes || disputes.length === 0) return null;

  // Show all disputes on this invoice — there could be historical closed
  // ones alongside an active one. Active render first.
  const sorted = [...disputes].sort((a, b) => {
    const aActive = isDisputeActive(a);
    const bActive = isDisputeActive(b);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime();
  });

  return (
    <div className="space-y-2">
      {sorted.map((d) => (
        <DisputeRow key={d.id} dispute={d} currency={currency} />
      ))}
    </div>
  );
}
