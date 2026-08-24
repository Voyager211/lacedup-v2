import * as Dialog from '@radix-ui/react-dialog';
import { BsX } from 'react-icons/bs';
import { cn } from '@/lib/cn';

/**
 * The one modal.
 *
 * Replaces 45 `bootstrap.Modal` instantiations across 24 distinct ids -
 * including five separate crop modals under two naming conventions and two
 * copies of the same address dialog.
 *
 * Radix handles what the Bootstrap version mostly did not: focus is trapped
 * and restored to whatever opened the dialog, Escape closes, the page behind
 * is inert to screen readers, and the title is wired to aria-labelledby.
 */

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
} as const;

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: keyof typeof SIZES;
  /** Buttons pinned to the bottom of the panel. */
  footer?: React.ReactNode;
  /**
   * Blocks closing by Escape, backdrop click and the X. Use while something
   * irreversible is in flight - a payment being verified, an upload finishing.
   */
  dismissible?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const Modal = ({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  footer,
  dismissible = true,
  className,
  children
}: ModalProps) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in" />

      <Dialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
          'flex-col rounded-xl bg-white shadow-xl',
          SIZES[size],
          className
        )}
        onEscapeKeyDown={(event) => !dismissible && event.preventDefault()}
        onPointerDownOutside={(event) => !dismissible && event.preventDefault()}
        onInteractOutside={(event) => !dismissible && event.preventDefault()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <Dialog.Title className="font-heading text-lg font-semibold text-ink">
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description className="mt-1 text-sm text-ink-muted">
                {description}
              </Dialog.Description>
            )}
          </div>

          {dismissible && (
            <Dialog.Close
              className="-mr-2 -mt-1 rounded p-1.5 text-ink-muted transition-colors hover:bg-card hover:text-ink"
              aria-label="Close"
            >
              <BsX className="size-5" aria-hidden="true" />
            </Dialog.Close>
          )}
        </header>

        {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>}

        {footer && (
          <footer className="flex justify-end gap-3 border-t border-line px-6 py-4">{footer}</footer>
        )}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export default Modal;
