import { useApproveReturnMutation, useRejectReturnMutation } from './adminOps.api';
import { useConfirm, usePrompt } from '@/components/confirm/useConfirm';
import { useToast } from '@/components/toast';
import { formatINR } from '@/lib/format';

/**
 * Approving and rejecting a return, for the list and the detail page alike.
 *
 * Approving is consequential - it refunds to the shopper's wallet and returns
 * the stock - so it is confirmed, and rejecting asks for a reason the shopper
 * will see. It is one decision whichever page it is made from, so it is asked
 * one way.
 */
export const REJECTION_REASONS = [
  'Item shows signs of wear',
  'Returned outside the return window',
  'Item does not match what was ordered',
  'Packaging or tags missing',
  'Other'
];

/** What either page has in hand for the return being decided. */
export interface ReturnDecisionTarget {
  /** The document _id - both routes look the return up by it, not by RET id. */
  _id: string;
  refundAmount?: number;
  totalPrice?: number;
}

export const useReturnDecision = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();

  const [approveReturn, { isLoading: isApproving }] = useApproveReturnMutation();
  const [rejectReturn, { isLoading: isRejecting }] = useRejectReturnMutation();

  const approve = async (target: ReturnDecisionTarget) => {
    const amount = Number(target.refundAmount ?? target.totalPrice ?? 0);

    const ok = await confirm({
      title: 'Approve this return?',
      message: `${formatINR(amount)} goes back to the shopper's wallet and the stock is returned.`,
      confirmLabel: 'Approve'
    });

    if (!ok) return;

    try {
      await approveReturn({ returnId: target._id }).unwrap();
      toast.success('Return approved');
    } catch (caught) {
      toast.fromError(caught, 'Could not approve that return.');
    }
  };

  const reject = async (target: ReturnDecisionTarget) => {
    const reason = await prompt({
      title: 'Reject this return?',
      message: 'The shopper is told why, so choose the closest reason.',
      options: REJECTION_REASONS,
      confirmLabel: 'Reject',
      tone: 'danger',
      requiredMessage: 'Choose a reason — the shopper sees it.'
    });

    if (!reason) return;

    try {
      await rejectReturn({ returnId: target._id, rejectionReason: reason }).unwrap();
      toast.success('Return rejected');
    } catch (caught) {
      toast.fromError(caught, 'Could not reject that return.');
    }
  };

  return { approve, reject, isDeciding: isApproving || isRejecting };
};
