import {
  Platform,
  EarningRecord,
  Withdrawal,
  EarningPayoutTransaction,
  ClassificationAudit,
  EarningClassification,
} from './types';

export interface EarningsSummary {
  verifiedReceivedPaise: number; // money actually received in ledger (via payouts)
  verifiedPendingPaise: number; // verified earnings not yet received/withdrawn
  uncertainPaise: number; // uncertain earnings total
  pendingWithdrawalsPaise: number; // requested/processing withdrawals
  totalWithdrawnPaise: number; // total lifetime received payouts
  withdrawableUserReportedPaise: number; // sum of platforms' user-reported balances
  lifetimeEarningsPaise: number; // verifiedReceivedPaise + verifiedPendingPaise (Uncertain is excluded)
  payoutSuccessRate: number | null; // percentage, or null if < 5 completed requests
}

/**
 * Computes the lifecycle totals for all earning records, withdrawals, and payouts.
 * Follows strict non-duplication rules:
 * - Lifetime earnings = verifiedReceived + verifiedPending (NOT double counting payouts).
 * - Uncertain is isolated and never enters verified totals or net worth.
 */
export function calculateEarningsSummary(
  records: EarningRecord[],
  withdrawals: Withdrawal[],
  payoutTransactions: EarningPayoutTransaction[],
  platforms: Platform[]
): EarningsSummary {
  let verifiedPendingPaise = 0;
  let uncertainPaise = 0;

  for (const rec of records) {
    if (rec.deletedAt) continue;

    const unallocated = Math.max(0, rec.inrAmountPaise - (rec.allocatedToWithdrawalPaise || 0));

    if (rec.classification === 'verified') {
      verifiedPendingPaise += unallocated;
    } else {
      // Uncertain: regardless of status, it remains in uncertain bucket
      uncertainPaise += rec.inrAmountPaise;
    }
  }

  // Calculate actual ledger payouts received
  let verifiedReceivedPaise = 0;
  for (const payout of payoutTransactions) {
    if (payout.deletedAt) continue;
    verifiedReceivedPaise += payout.amountPaise;
  }

  // Pending withdrawals
  let pendingWithdrawalsPaise = 0;
  let completedWithdrawalsCount = 0;
  let successfulWithdrawalsCount = 0;

  for (const w of withdrawals) {
    if (w.deletedAt) continue;
    if (w.status === 'requested' || w.status === 'processing') {
      pendingWithdrawalsPaise += w.amountPaise;
    } else if (w.status === 'received') {
      completedWithdrawalsCount++;
      successfulWithdrawalsCount++;
    } else if (w.status === 'rejected' || w.status === 'failed') {
      completedWithdrawalsCount++;
    }
  }

  // User-reported withdrawable balances
  let withdrawableUserReportedPaise = 0;
  for (const p of platforms) {
    if (p.deletedAt) continue;
    withdrawableUserReportedPaise += p.withdrawableBalanceReportedPaise || 0;
  }

  // Payout success rate only if at least 5 completed requests exist
  let payoutSuccessRate: number | null = null;
  if (completedWithdrawalsCount >= 5) {
    payoutSuccessRate = Math.round(
      (successfulWithdrawalsCount / completedWithdrawalsCount) * 100
    );
  }

  return {
    verifiedReceivedPaise,
    verifiedPendingPaise,
    uncertainPaise,
    pendingWithdrawalsPaise,
    totalWithdrawnPaise: verifiedReceivedPaise,
    withdrawableUserReportedPaise,
    lifetimeEarningsPaise: verifiedReceivedPaise + verifiedPendingPaise,
    payoutSuccessRate,
  };
}

/**
 * Validates and allocates an earning record towards a withdrawal or payout.
 * Throws or returns error if requested allocation exceeds remaining unallocated amount.
 */
export function allocateEarningRecord(
  record: EarningRecord,
  requestedAllocationPaise: number
): { success: boolean; updatedRecord?: EarningRecord; error?: string } {
  const currentAllocated = record.allocatedToWithdrawalPaise || 0;
  const remainingPaise = record.inrAmountPaise - currentAllocated;

  if (requestedAllocationPaise <= 0) {
    return { success: false, error: 'Allocation amount must be greater than zero' };
  }

  if (requestedAllocationPaise > remainingPaise) {
    return {
      success: false,
      error: `Cannot allocate ₹${(requestedAllocationPaise / 100).toFixed(2)}; only ₹${(
        remainingPaise / 100
      ).toFixed(2)} remaining on this earning record.`,
    };
  }

  const updatedRecord: EarningRecord = {
    ...record,
    allocatedToWithdrawalPaise: currentAllocated + requestedAllocationPaise,
    updatedAt: new Date().toISOString(),
  };

  return { success: true, updatedRecord };
}

/**
 * Reverts allocations on earning records when a withdrawal is rejected, failed, or a payout is deleted.
 */
export function revertRecordAllocations(
  records: EarningRecord[],
  allocationsToRevert: { earningRecordId: string; amountPaise: number }[]
): EarningRecord[] {
  const revertMap = new Map<string, number>();
  for (const a of allocationsToRevert) {
    revertMap.set(a.earningRecordId, (revertMap.get(a.earningRecordId) || 0) + a.amountPaise);
  }

  return records.map(rec => {
    const toRevert = revertMap.get(rec.id);
    if (!toRevert) return rec;

    const newAllocated = Math.max(0, (rec.allocatedToWithdrawalPaise || 0) - toRevert);
    return {
      ...rec,
      allocatedToWithdrawalPaise: newAllocated,
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Reclassifies an earning record between Verified and Uncertain with an audit log.
 * Reclassification does NOT affect ledger balances.
 */
export function reclassifyEarningRecord(
  record: EarningRecord,
  targetClassification: EarningClassification,
  reason: string,
  uncertainDetails?: {
    confidenceLevel?: 'low' | 'medium' | 'high';
    reasonForUncertainty?: string;
    reviewDate?: string;
  }
): EarningRecord {
  const now = new Date().toISOString();
  const auditEntry: ClassificationAudit = {
    fromClassification: record.classification,
    toClassification: targetClassification,
    timestamp: now,
    reason,
  };

  return {
    ...record,
    classification: targetClassification,
    confidenceLevel:
      targetClassification === 'uncertain'
        ? uncertainDetails?.confidenceLevel ?? record.confidenceLevel ?? 'medium'
        : undefined,
    reasonForUncertainty:
      targetClassification === 'uncertain'
        ? uncertainDetails?.reasonForUncertainty ?? record.reasonForUncertainty ?? reason
        : undefined,
    reviewDate:
      targetClassification === 'uncertain'
        ? uncertainDetails?.reviewDate ?? record.reviewDate ?? ''
        : undefined,
    auditTrail: [...(record.auditTrail || []), auditEntry],
    updatedAt: now,
  };
}
