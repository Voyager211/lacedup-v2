import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useGetAdminOrderQuery,
  useGetOrderTransitionsQuery,
  useUpdateItemStatusMutation,
  useUpdateOrderStatusMutation
} from './adminOps.api';
import Badge, { ORDER_STATUS_TONE, PAYMENT_STATUS_TONE, paymentMethodTone } from '@/components/Badge';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { SelectField, TextAreaField } from '@/components/form/TextField';
import { useToast } from '@/components/toast';
import { formatDate, formatINR } from '@/lib/format';
import { ORDER_STATUS, type OrderStatus, type PaymentStatus } from '@/types/domain';

/**
 * Admin order details.
 *
 * The EJS version was 2,320 lines, 1,373 of them script - and almost all of
 * that was hand-written DOM synchronisation: updateOrderStatusInUI,
 * updateItemStatusInUI, updatePaymentStatusInUI, updateButtonVisibility,
 * updateModalDataAfterStatusChange, fetchAndUpdateOrderStatus, plus
 * client-side copies of getStatusColor and getPaymentStatusColor that were
 * already being passed in as template locals.
 *
 * None of that survives. A mutation invalidates the order and the page
 * re-renders from what the server now says.
 */

/** Statuses an item can be moved to directly. */
const ITEM_STATUSES: string[] = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED
];

const PARTIAL_STATES: string[] = [
  ORDER_STATUS.PARTIALLY_DELIVERED,
  ORDER_STATUS.PARTIALLY_RETURNED
];

/** Items here are finished with - nothing can be changed on them. */
const SETTLED_ITEM_STATES: string[] = [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED];

const AdminOrderDetailsPage = () => {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const toast = useToast();

  const { data, isLoading, error, refetch } = useGetAdminOrderQuery(orderId, { skip: !orderId });
  const transitions = useGetOrderTransitionsQuery(orderId, { skip: !orderId });

  const [updateOrderStatus, { isLoading: isUpdatingOrder }] = useUpdateOrderStatusMutation();
  const [updateItemStatus] = useUpdateItemStatusMutation();

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [notes, setNotes] = useState('');

  const order = data?.order;
  const allowed = transitions.data?.allowedTransitions ?? [];
  const isPartial = PARTIAL_STATES.includes(order?.status ?? '');

  const submitStatus = async () => {
    if (!nextStatus) return;

    try {
      await updateOrderStatus({ orderId, status: nextStatus, notes }).unwrap();
      toast.success(`Order moved to ${nextStatus}`);
      setStatusDialogOpen(false);
      setNextStatus('');
      setNotes('');
    } catch (caught) {
      toast.fromError(caught, 'Could not update that order.');
    }
  };

  const setItem = async (itemId: string, status: string) => {
    try {
      await updateItemStatus({ orderId, itemId, status }).unwrap();
      toast.success(`Item moved to ${status}`);
    } catch (caught) {
      toast.fromError(caught, 'Could not update that item.');
    }
  };

  return (
    <div className="max-w-4xl">


      <QueryBoundary
        isLoading={isLoading}
        error={error}
        skeleton={<SkeletonText lines={10} />}
        onRetry={refetch}
      >
        {order && (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-heading text-2xl font-semibold text-ink">
                  Order {order.orderId}
                </h1>
                <p className="mt-1 text-sm text-ink-muted">
                  Placed {formatDate(order.createdAt as string)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone={ORDER_STATUS_TONE[order.status as OrderStatus] ?? 'secondary'}>
                  {order.status}
                </Badge>
                {typeof order.paymentStatus === 'string' && (
                  <Badge
                    tone={PAYMENT_STATUS_TONE[order.paymentStatus as PaymentStatus] ?? 'secondary'}
                  >
                    {order.paymentStatus}
                  </Badge>
                )}
                {typeof order.paymentMethod === 'string' && (
                  <Badge tone={paymentMethodTone(order.paymentMethod)} uppercase>
                    {order.paymentMethod}
                  </Badge>
                )}
              </div>
            </header>

            <div className="mt-6">
              {allowed.length > 0 ? (
                <Button onClick={() => setStatusDialogOpen(true)}>Change order status</Button>
              ) : (
                /*
                 * The server has no order-level transitions for the partial
                 * states, so it returns an empty list. The EJS admin rendered
                 * that as an empty dropdown with no explanation, which is the
                 * single worst piece of UX in the old panel - it looks broken.
                 */
                <p className="rounded-md bg-info/10 px-4 py-3 text-sm text-ink">
                  {isPartial
                    ? 'Items in this order are at different stages, so the order status is calculated from them. Change the items below and the order follows.'
                    : `An order that is ${order.status} has no further status changes.`}
                </p>
              )}
            </div>

            <section className="mt-8 rounded-lg border border-line bg-white">
              <h2 className="border-b border-line px-5 py-4 font-heading text-lg font-semibold text-ink">
                Items
              </h2>

              <ul className="divide-y divide-line">
                {order.items?.map((item) => {
                  const itemStatus = String(item.status ?? order.status);
                  const settled = SETTLED_ITEM_STATES.includes(itemStatus);

                  return (
                    <li key={item._id} className="flex flex-wrap items-center gap-4 p-5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">
                          {String(item.productName ?? (item.productId as { productName?: string })?.productName ?? '')}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-muted">
                          {item.size ? `Size ${item.size} · ` : ''}Qty {String(item.quantity ?? 1)} ·{' '}
                          {formatINR(Number(item.totalPrice ?? 0))}
                        </p>
                      </div>

                      <Badge
                        size="sm"
                        tone={ORDER_STATUS_TONE[itemStatus as OrderStatus] ?? 'secondary'}
                      >
                        {itemStatus}
                      </Badge>

                      {settled ? (
                        <span className="text-sm text-ink-muted">No further changes</span>
                      ) : (
                        <label className="flex items-center gap-2 text-sm">
                          <span className="sr-only">Change status for this item</span>
                          <select
                            value=""
                            onChange={(event) => {
                              if (event.target.value) setItem(item._id, event.target.value);
                            }}
                            className="rounded-md border border-line px-2 py-1.5 text-sm"
                          >
                            <option value="">Change to…</option>
                            {ITEM_STATUSES.filter((status) => status !== itemStatus).map(
                              (status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <Modal
              open={statusDialogOpen}
              onOpenChange={setStatusDialogOpen}
              title="Change order status"
              description={`Currently ${order.status}.`}
              size="sm"
              footer={
                <>
                  <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    loading={isUpdatingOrder}
                    disabled={!nextStatus}
                    onClick={submitStatus}
                  >
                    Update
                  </Button>
                </>
              }
            >
              <div className="space-y-4">
                <SelectField
                  label="New status"
                  placeholder="Choose a status…"
                  // Only what the server will accept - it rejects anything else.
                  options={allowed.map((status) => ({ value: status, label: status }))}
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value)}
                />

                <TextAreaField
                  label="Note"
                  hint="Optional — recorded in the order history"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </Modal>
          </>
        )}
      </QueryBoundary>
    </div>
  );
};

export default AdminOrderDetailsPage;
