import { useNavigate } from "react-router-dom";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { parseISO, differenceInHours } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveDisputesForOrg, type PaymentDispute } from "@/hooks/useInvoiceDisputes";
import { formatCurrencyMinor, formatDateUK } from "@/lib/utils";

function deadlineLabel(due: string | null): string {
  if (!due) return "—";
  const hours = differenceInHours(parseISO(due), new Date());
  if (hours < 0) return "OVERDUE";
  if (hours < 48) return `${hours}h left`;
  return formatDateUK(parseISO(due), "dd MMM");
}

export function ActiveDisputesCard() {
  const { data: disputes } = useActiveDisputesForOrg();
  const navigate = useNavigate();

  if (!disputes || disputes.length === 0) return null;

  return (
    <Card className="border-red-300 dark:border-red-800/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          Active chargebacks ({disputes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {disputes.slice(0, 5).map((d: PaymentDispute) => (
            <button
              key={d.id}
              type="button"
              onClick={() => navigate(`/invoices/${d.invoice_id}`)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 text-left transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {formatCurrencyMinor(d.amount_minor, d.currency_code?.toUpperCase() || "GBP")}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    {d.reason.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {d.status === "needs_response" || d.status === "warning_needs_response"
                    ? `Respond by ${deadlineLabel(d.evidence_due_by)}`
                    : "Under review"}
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
        {disputes.length > 5 && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-t">
            + {disputes.length - 5} more — open the invoices individually to respond
          </div>
        )}
      </CardContent>
    </Card>
  );
}
