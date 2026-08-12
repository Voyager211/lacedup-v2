import { createContext, useCallback, useMemo, useRef, useState } from 'react';
import Modal from '../Modal';
import Button from '../Button';

/**
 * Promise-based confirmation and reason prompts.
 *
 * Around 120 of the 262 SweetAlert2 calls in the EJS layer were confirmations,
 * and another handful were `input: 'select'` reason pickers on the cancel and
 * return flows. Both shapes live here so a caller can `await` a decision
 * instead of threading callbacks:
 *
 *   if (!(await confirm({ title: 'Remove this item?' }))) return;
 *
 *   const reason = await prompt({ title: 'Why are you cancelling?', options: REASONS });
 *   if (!reason) return;
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for irreversible actions - cancelling an order, deleting a product. */
  tone?: 'primary' | 'danger';
}

export interface PromptOptions extends ConfirmOptions {
  options: readonly string[];
  placeholder?: string;
  /** Shown when the picker is submitted with nothing chosen. */
  requiredMessage?: string;
}

type Request =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const ConfirmProvider = ({ children }: { children: React.ReactNode }) => {
  const [request, setRequest] = useState<Request | null>(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Held in a ref as well as state so settle() always closes over the live
  // request rather than the one captured when the handler was created.
  const active = useRef<Request | null>(null);

  const open = useCallback((next: Request) => {
    active.current = next;
    setSelected('');
    setError(null);
    setRequest(next);
  }, []);

  const settle = useCallback((value: boolean | string | null) => {
    const current = active.current;
    active.current = null;
    setRequest(null);

    if (!current) return;

    if (current.kind === 'confirm') current.resolve(value === true);
    else current.resolve(typeof value === 'string' && value ? value : null);
  }, []);

  const value = useMemo<ConfirmContextValue>(
    () => ({
      confirm: (options) =>
        new Promise<boolean>((resolve) => open({ kind: 'confirm', options, resolve })),
      prompt: (options) =>
        new Promise<string | null>((resolve) => open({ kind: 'prompt', options, resolve }))
    }),
    [open]
  );

  const options = request?.options;
  const isPrompt = request?.kind === 'prompt';

  const onConfirm = () => {
    if (!isPrompt) return settle(true);

    if (!selected) {
      setError(request.options.requiredMessage ?? 'Please choose a reason to continue.');
      return;
    }

    settle(selected);
  };

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      <Modal
        open={request !== null}
        // Dismissing any other way - Escape, backdrop, the X - is a decline,
        // never a silently unresolved promise.
        onOpenChange={(next) => !next && settle(isPrompt ? null : false)}
        title={options?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => settle(isPrompt ? null : false)}>
              {options?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button variant={options?.tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
              {options?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {options?.message && <p className="text-ink-muted">{options.message}</p>}

        {isPrompt && (
          <div className={options?.message ? 'mt-4' : undefined}>
            <label htmlFor="confirm-reason" className="sr-only">
              {options?.title}
            </label>
            <select
              id="confirm-reason"
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-errormessage={error ? 'confirm-reason-error' : undefined}
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-ink"
            >
              <option value="">{request.options.placeholder ?? 'Select a reason…'}</option>
              {request.options.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            {error && (
              <p id="confirm-reason-error" role="alert" className="mt-2 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
};
