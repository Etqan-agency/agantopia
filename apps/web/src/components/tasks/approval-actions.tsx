"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDecideApproval } from "@/hooks/use-api";

/** Approve / deny buttons for one ApprovalRequest. */
export function ApprovalActions({ companyId, approvalId, title }: { companyId: string; approvalId: string; title: string }) {
  const decide = useDecideApproval(companyId);
  const pendingDecision = decide.isPending ? decide.variables?.decision : undefined;
  function run(decision: "APPROVED" | "DENIED") {
    // Toasts fire from the hook so they still show if this strip unmounts before the response.
    decide.mutate({ id: approvalId, decision, title });
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => run("APPROVED")} pending={pendingDecision === "APPROVED"} disabled={decide.isPending} aria-label={`Approve: ${title}`}>
        <Check aria-hidden />
        Approve
      </Button>
      <Button size="sm" variant="danger-outline" onClick={() => run("DENIED")} pending={pendingDecision === "DENIED"} disabled={decide.isPending} aria-label={`Deny: ${title}`}>
        <X aria-hidden />
        Deny
      </Button>
    </div>
  );
}
