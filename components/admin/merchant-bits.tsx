import { Badge } from "@/components/ui/badge";
import { planLabel, statusLabel } from "@/lib/admin/types";
import type { MerchantStatus, Plan } from "@/lib/admin/types";

const statusTone: Record<MerchantStatus, "success" | "brand" | "pending" | "danger" | "neutral"> = {
  active: "success",
  trial: "brand",
  past_due: "pending",
  suspended: "danger",
  churned: "neutral",
};

export function MerchantStatusBadge({ status }: { status: MerchantStatus }) {
  return (
    <Badge tone={statusTone[status]} dot>
      {statusLabel[status]}
    </Badge>
  );
}

export function PlanBadge({ plan }: { plan: Plan }) {
  return <Badge tone={plan === "starter" ? "neutral" : "brand"}>{planLabel[plan]}</Badge>;
}
