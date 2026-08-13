import { useNavigate } from 'react-router-dom';
import {
  useCancelItemMutation,
  useCancelOrderMutation,
  useReturnItemMutation,
  useReturnOrderMutation
} from './orders.api';
import { usePrompt } from '@/components/confirm/useConfirm';
import { useToast } from '@/components/toast';
import { api as client } from '@/api/client';

/**
 * Cancel and return, at order or item level.
 *
 * Replaces `orders-common.js` - 326 lines that put a SweetAlert reason picker
 * in front of each action, then a blocking loading modal, then reloaded the
 * page. The reload is what RTK Query's cache invalidation replaces.
 *
 * The reason lists come from the server with the order. They are a server
 * enum, and it rejects anything outside its own list, so a hardcoded client
 * copy would drift the moment one is added.
 */
export const useOrderActions = (reasons: {
  cancellation: string[];
  return: string[];
}) => {
  const prompt = usePrompt();
  const toast = useToast();
  const navigate = useNavigate();

  const [cancelOrder] = useCancelOrderMutation();
  const [cancelItem] = useCancelItemMutation();
  const [returnOrder] = useReturnOrderMutation();
  const [returnItem] = useReturnItemMutation();

  const run = async (
    action: () => Promise<{ message?: string }>,
    fallback: string
  ): Promise<boolean> => {
    try {
      const result = await action();
      toast.success(result?.message ?? fallback);
      return true;
    } catch (caught) {
      toast.fromError(caught, 'That did not work.');
      return false;
    }
  };

  return {
    cancelWholeOrder: async (orderId: string) => {
      const reason = await prompt({
        title: 'Cancel this order?',
        message: 'Every item still eligible will be cancelled. Paid orders refund to your wallet.',
        options: reasons.cancellation,
        confirmLabel: 'Cancel order',
        cancelLabel: 'Keep it',
        tone: 'danger',
        requiredMessage: 'Please choose a reason so we can cancel this.'
      });

      if (!reason) return false;
      return run(() => cancelOrder({ orderId, reason }).unwrap(), 'Order cancelled');
    },

    cancelOneItem: async (orderId: string, itemId: string) => {
      const reason = await prompt({
        title: 'Cancel this item?',
        message: 'The rest of your order is unaffected.',
        options: reasons.cancellation,
        confirmLabel: 'Cancel item',
        cancelLabel: 'Keep it',
        tone: 'danger'
      });

      if (!reason) return false;
      return run(() => cancelItem({ orderId, itemId, reason }).unwrap(), 'Item cancelled');
    },

    returnWholeOrder: async (orderId: string) => {
      const reason = await prompt({
        title: 'Return this order?',
        message: 'We will review your request and refund to your wallet once approved.',
        options: reasons.return,
        confirmLabel: 'Request return'
      });

      if (!reason) return false;
      return run(() => returnOrder({ orderId, reason }).unwrap(), 'Return requested');
    },

    returnOneItem: async (orderId: string, itemId: string) => {
      const reason = await prompt({
        title: 'Return this item?',
        options: reasons.return,
        confirmLabel: 'Request return'
      });

      if (!reason) return false;
      return run(() => returnItem({ orderId, itemId, reason }).unwrap(), 'Return requested');
    },

    /**
     * Downloads the invoice.
     *
     * Fetched rather than linked so it travels through the axios client, and
     * therefore through the refresh-on-401 interceptor - a plain anchor on an
     * expired session downloads the login page instead of the invoice.
     */
    downloadInvoice: async (orderId: string) => {
      try {
        const response = await client.get(`/orders/${orderId}/invoice`, {
          responseType: 'blob'
        });

        const url = URL.createObjectURL(response.data as Blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${orderId}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (caught) {
        toast.fromError(caught, 'Could not download that invoice.');
      }
    },

    trackOrder: (orderId: string) => {
      // The EJS version popped a "coming soon" alert. Sending them to the
      // order is at least useful - its status history is the tracking there is.
      navigate(`/orders/${orderId}`);
    }
  };
};
