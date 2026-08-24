import { Toaster as SonnerToaster, toast } from 'sonner';
import { errorMessage } from '@/api/client';

/**
 * The one toast system.
 *
 * Three libraries were loaded before this: SweetAlert2 (262 calls), Toastr
 * (35, storefront only), and Toastify (0 calls - loaded on every admin page
 * and never used). product-details.ejs used SweetAlert and Toastr for the same
 * class of feedback; checkout.js mixed both within one file; and auth pages had
 * no Toastr at all because their layout did not load it.
 *
 * Positioned top-right with a 4s timeout to match the Toastr config the
 * storefront had, so the feel is unchanged.
 */
export const Toaster = () => (
  <SonnerToaster
    position="top-right"
    duration={4000}
    visibleToasts={3}
    closeButton
    toastOptions={{
      classNames: {
        toast: 'rounded-lg border border-line bg-white text-ink shadow-lg',
        description: 'text-ink-muted',
        success: 'border-l-4 border-l-success',
        error: 'border-l-4 border-l-danger',
        warning: 'border-l-4 border-l-warning',
        info: 'border-l-4 border-l-info'
      }
    }}
  />
);

/**
 * Transient feedback.
 *
 * `fromError` is the one worth knowing about: it unpacks whichever field the
 * backend used for its message - controllers variously send `message`, `error`
 * or an express-validator `errors` array - and explains a 429 rather than
 * passing through a body that reads like a server fault.
 */
export const useToast = () => ({
  success: (message: string, description?: string) => toast.success(message, { description }),
  error: (message: string, description?: string) => toast.error(message, { description }),
  warning: (message: string, description?: string) => toast.warning(message, { description }),
  info: (message: string, description?: string) => toast.info(message, { description }),

  fromError: (error: unknown, fallback?: string) => toast.error(errorMessage(error, fallback)),

  /** Ties a toast to a promise: pending, then resolved or rejected. */
  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error?: string }
  ) =>
    toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: (error: unknown) => errorMessage(error, messages.error)
    }),

  dismiss: (id?: string | number) => toast.dismiss(id)
});
