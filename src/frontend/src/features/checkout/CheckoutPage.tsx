import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BsCashCoin, BsCreditCard2Back, BsPlus, BsWallet2 } from 'react-icons/bs';
import {
  useApplyCouponMutation,
  useCreateRazorpayOrderMutation,
  useGetCheckoutQuery,
  usePayFromWalletMutation,
  usePlaceOrderMutation,
  useRemoveCouponMutation,
  useReportPaymentFailureMutation,
  useValidateCheckoutStockMutation,
  useVerifyRazorpayPaymentMutation,
  type PaymentMethod
} from './checkout.api';
import { useRazorpay } from './useRazorpay';
import AddressFormDialog from '@/features/addresses/AddressFormDialog';
import { useAppSelector } from '@/app/store';
import { selectUser } from '@/features/auth/authSlice';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { useToast } from '@/components/toast';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Checkout.
 *
 * The 2,053 lines in checkout.js, minus the parts that no longer apply: the
 * PayPal path (its client id was always empty, so the button could never
 * work), and the DOM bookkeeping that recalculated totals in the browser.
 *
 * Totals come from the server on every read. It re-prices the cart as it goes,
 * so a total computed here could disagree with what is actually charged.
 *
 * Three payment paths:
 *   COD     - places the order immediately
 *   Wallet  - debits and places, refused server-side if the balance is short
 *   Card    - creates a Razorpay order plus a server-side snapshot, opens the
 *             sheet, then verifies. No order row exists until verification.
 */

const PAYMENT_METHODS = [
  { value: 'upi' as const, label: 'Card / UPI / Netbanking', icon: BsCreditCard2Back },
  { value: 'wallet' as const, label: 'Wallet', icon: BsWallet2 },
  { value: 'cod' as const, label: 'Cash on delivery', icon: BsCashCoin }
];

const CheckoutPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const openRazorpay = useRazorpay();
  const user = useAppSelector(selectUser('user'));

  const { data, isLoading, error, refetch } = useGetCheckoutQuery();

  const [validateStock] = useValidateCheckoutStockMutation();
  const [applyCoupon, { isLoading: isApplyingCoupon }] = useApplyCouponMutation();
  const [removeCoupon] = useRemoveCouponMutation();
  const [placeOrder] = usePlaceOrderMutation();
  const [payFromWallet] = usePayFromWalletMutation();
  const [createRazorpayOrder] = useCreateRazorpayOrderMutation();
  const [verifyPayment] = useVerifyRazorpayPaymentMutation();
  const [reportFailure] = useReportPaymentFailureMutation();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [couponCode, setCouponCode] = useState('');
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [placing, setPlacing] = useState(false);

  const addresses = data?.addresses ?? [];

  // Default to the address marked default, else the first. Only until the
  // shopper picks one - after that their choice stands.
  useEffect(() => {
    if (selectedIndex !== null || addresses.length === 0) return;

    const defaultIndex = addresses.findIndex((address) => address.isDefault);
    setSelectedIndex(defaultIndex >= 0 ? defaultIndex : 0);
  }, [addresses, selectedIndex]);

  const walletShort = method === 'wallet' && (data?.walletBalance ?? 0) < (data?.total ?? 0);
  const canPay =
    selectedIndex !== null && (data?.cartItems.length ?? 0) > 0 && !walletShort && !placing;

  const onCoupon = async () => {
    if (!couponCode.trim()) return;

    try {
      await applyCoupon(couponCode.trim().toUpperCase()).unwrap();
      setCouponCode('');
      toast.success('Coupon applied');
    } catch (caught) {
      toast.fromError(caught, 'That coupon could not be applied.');
    }
  };

  /** Shared prologue: nothing is charged until stock has been rechecked. */
  const ensureStock = async (): Promise<boolean> => {
    try {
      const result = await validateStock().unwrap();

      if (result.success === false || (result.invalidItems?.length ?? 0) > 0) {
        toast.error(
          result.message ?? 'Some items are no longer available',
          'Your cart has been updated.'
        );
        void refetch();
        return false;
      }

      return true;
    } catch (caught) {
      toast.fromError(caught, 'Could not confirm stock.');
      return false;
    }
  };

  const pay = async () => {
    if (!canPay || selectedIndex === null || !data?.addressDocumentId) return;

    setPlacing(true);

    try {
      if (!(await ensureStock())) return;

      const order = {
        deliveryAddressId: data.addressDocumentId,
        addressIndex: selectedIndex
      };

      if (method === 'cod' || method === 'wallet') {
        const action = method === 'wallet' ? payFromWallet : placeOrder;
        const result = await action({ ...order, paymentMethod: method }).unwrap();

        const orderNumber = result.data?.orderNumber ?? result.orderId;
        toast.success('Order placed');
        navigate(`/checkout/order-success/${orderNumber ?? ''}`);
        return;
      }

      // Card: create the Razorpay order and the server-side snapshot first.
      const created = await createRazorpayOrder(order).unwrap();
      const { razorpayOrderId, amount, currency, keyId } = created.data;

      await openRazorpay({
        orderId: razorpayOrderId,
        amount,
        currency,
        keyId,
        ...(user ? { customer: { name: user.name, email: user.email } } : {}),

        onSuccess: async (response) => {
          try {
            const result = await verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            }).unwrap();

            toast.success('Payment successful');
            navigate(`/checkout/order-success/${result.data?.orderNumber ?? ''}`);
          } catch (caught) {
            // The money may well have left. Say so plainly rather than
            // implying the payment failed.
            toast.error(
              'We could not confirm your payment',
              'If you were charged, your order will appear shortly. Check your orders before paying again.'
            );
            navigate('/orders');
          } finally {
            setPlacing(false);
          }
        },

        onDismiss: async (reason) => {
          setPlacing(false);

          if (reason === 'unavailable') {
            toast.error('The payment window could not be opened', 'Check your connection and try again.');
            return;
          }

          // Recorded, not ignored: a dismissed sheet leaves a Razorpay order
          // and a snapshot outstanding, and the retry page needs something to
          // show.
          try {
            await reportFailure({ razorpayOrderId, error: { reason: 'dismissed' } }).unwrap();
          } catch {
            /* nothing was charged - the record is a convenience, not a debt */
          }

          toast.info('Payment cancelled');
        }
      });
    } catch (caught) {
      toast.fromError(caught, 'Could not place your order.');
    } finally {
      // The card path clears this in its own callbacks, once the sheet closes.
      if (method !== 'upi') setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-heading text-3xl font-semibold text-ink">Checkout</h1>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={(data?.cartItems.length ?? 0) === 0}
        skeleton={<SkeletonText lines={8} />}
        empty={
          <EmptyState
            title="Your cart is empty"
            message="Add something before checking out."
            action={
              <Link
                to="/shop"
                className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-hover"
              >
                Browse the shop
              </Link>
            }
          />
        }
        onRetry={refetch}
      >
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-8">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold text-ink">Delivery address</h2>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<BsPlus className="size-4" aria-hidden="true" />}
                  onClick={() => setAddressDialogOpen(true)}
                >
                  Add new
                </Button>
              </div>

              {addresses.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-muted">
                  You have no saved addresses. Add one to continue.
                </p>
              ) : (
                <fieldset className="space-y-3">
                  <legend className="sr-only">Choose a delivery address</legend>

                  {addresses.map((address, index) => (
                    <label
                      key={address._id ?? index}
                      className={cn(
                        'flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors',
                        selectedIndex === index
                          ? 'border-brand bg-brand/5'
                          : 'border-line hover:border-ink'
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={selectedIndex === index}
                        onChange={() => setSelectedIndex(index)}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">
                          {address.name}
                          <span className="ml-2 rounded bg-card px-2 py-0.5 text-xs text-ink-muted">
                            {address.addressType}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm text-ink-muted">
                          {address.landMark}, {address.city}, {address.district}, {address.state} —{' '}
                          {address.pincode}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-muted">{address.phone}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </section>

            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-ink">Payment method</h2>

              <fieldset className="space-y-3">
                <legend className="sr-only">Choose a payment method</legend>

                {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                  <label
                    key={value}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors',
                      method === value ? 'border-brand bg-brand/5' : 'border-line hover:border-ink'
                    )}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={method === value}
                      onChange={() => setMethod(value)}
                    />
                    <Icon className="size-5 text-ink-muted" aria-hidden="true" />
                    <span className="font-medium text-ink">{label}</span>

                    {value === 'wallet' && (
                      <span className="ml-auto text-sm text-ink-muted">
                        {formatINR(data?.walletBalance ?? 0)}
                      </span>
                    )}
                  </label>
                ))}
              </fieldset>

              {walletShort && (
                <p role="alert" className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                  Your wallet balance is {formatINR(data?.walletBalance ?? 0)}, which is less than
                  the {formatINR(data?.total ?? 0)} due. Top up, or choose another method.
                </p>
              )}
            </section>
          </div>

          <aside className="w-full shrink-0 lg:w-80">
            <div className="space-y-4 rounded-lg border border-line bg-white p-5">
              <h2 className="font-heading text-lg font-semibold text-ink">Summary</h2>

              {data?.appliedCoupon ? (
                <div className="flex items-center justify-between rounded-md bg-success/10 px-3 py-2 text-sm">
                  <span className="font-medium text-success">
                    {data.appliedCoupon.code} applied
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await removeCoupon().unwrap().catch(() => {});
                      toast.info('Coupon removed');
                    }}
                    className="text-ink-muted hover:text-danger"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <label htmlFor="coupon" className="sr-only">
                    Coupon code
                  </label>
                  <input
                    id="coupon"
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                    placeholder="Coupon code"
                    className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm uppercase"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    loading={isApplyingCoupon}
                    onClick={onCoupon}
                  >
                    Apply
                  </Button>
                </div>
              )}

              <dl className="space-y-2 border-t border-line pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Items ({data?.totalItemCount ?? 0})</dt>
                  <dd className="text-ink">{formatINR(data?.subtotal ?? 0)}</dd>
                </div>

                {(data?.totalDiscount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Offers</dt>
                    <dd className="text-success">−{formatINR(data?.totalDiscount ?? 0)}</dd>
                  </div>
                )}

                {(data?.couponDiscount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Coupon</dt>
                    <dd className="text-success">−{formatINR(data?.couponDiscount ?? 0)}</dd>
                  </div>
                )}

                <div className="flex justify-between">
                  <dt className="text-ink-muted">Delivery</dt>
                  <dd className="text-ink">
                    {(data?.shipping ?? 0) === 0 ? 'Free' : formatINR(data?.shipping ?? 0)}
                  </dd>
                </div>
              </dl>

              <div className="flex justify-between border-t border-line pt-4">
                <span className="font-medium text-ink">Total</span>
                <span className="font-semibold text-ink">{formatINR(data?.total ?? 0)}</span>
              </div>

              <Button fullWidth size="lg" loading={placing} disabled={!canPay} onClick={pay}>
                {method === 'cod' ? 'Place order' : `Pay ${formatINR(data?.total ?? 0)}`}
              </Button>

              {selectedIndex === null && addresses.length > 0 && (
                <p className="text-center text-xs text-ink-muted">Choose a delivery address</p>
              )}
            </div>
          </aside>
        </div>
      </QueryBoundary>

      <AddressFormDialog
        open={addressDialogOpen}
        onOpenChange={setAddressDialogOpen}
        onSaved={refetch}
      />
    </div>
  );
};

export default CheckoutPage;
