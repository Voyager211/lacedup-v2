import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmProvider } from './ConfirmProvider';
import { useConfirm, usePrompt } from './useConfirm';

/**
 * The confirm flow replaces roughly 120 SweetAlert confirmations. The risk is
 * in the plumbing rather than the markup: a promise that never settles leaves
 * the caller awaiting forever, and a dialog dismissed by Escape or the
 * backdrop has to count as a decline rather than vanish silently.
 */

const ConfirmHarness = () => {
  const confirm = useConfirm();
  const [result, setResult] = useState<string>('pending');

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          const ok = await confirm({ title: 'Cancel this order?', confirmLabel: 'Yes, cancel' });
          setResult(String(ok));
        }}
      >
        open
      </button>
      <output>{result}</output>
    </div>
  );
};

const PromptHarness = () => {
  const prompt = usePrompt();
  const [result, setResult] = useState<string>('pending');

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          const reason = await prompt({
            title: 'Why are you cancelling?',
            options: ['Ordered by mistake', 'Changed my mind']
          });
          setResult(String(reason));
        }}
      >
        open
      </button>
      <output>{result}</output>
    </div>
  );
};

const renderWithProvider = (ui: React.ReactNode) =>
  render(<ConfirmProvider>{ui}</ConfirmProvider>);

describe('useConfirm', () => {
  it('resolves true when confirmed', async () => {
    renderWithProvider(<ConfirmHarness />);

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, cancel' }));

    expect(await screen.findByText('true')).toBeInTheDocument();
  });

  it('resolves false when cancelled', async () => {
    renderWithProvider(<ConfirmHarness />);

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('false')).toBeInTheDocument();
  });

  it('treats Escape as a decline rather than leaving the promise hanging', async () => {
    renderWithProvider(<ConfirmHarness />);

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');

    expect(await screen.findByText('false')).toBeInTheDocument();
  });

  it('closes the dialog once a decision is made', async () => {
    renderWithProvider(<ConfirmHarness />);

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('can be reopened, resolving each call independently', async () => {
    renderWithProvider(<ConfirmHarness />);

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('false')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, cancel' }));
    expect(await screen.findByText('true')).toBeInTheDocument();
  });
});

describe('usePrompt', () => {
  it('resolves the chosen reason', async () => {
    renderWithProvider(<PromptHarness />);

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.selectOptions(await screen.findByRole('combobox'), 'Changed my mind');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Changed my mind')).toBeInTheDocument();
  });

  it('refuses to submit with nothing chosen, and says so', async () => {
    renderWithProvider(<PromptHarness />);

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/choose a reason/i);
    // Still open, still unresolved - not silently accepted as empty.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('resolves null when cancelled', async () => {
    renderWithProvider(<PromptHarness />);

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('null')).toBeInTheDocument();
  });

  it('does not carry a previous selection into the next prompt', async () => {
    renderWithProvider(<PromptHarness />);

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.selectOptions(await screen.findByRole('combobox'), 'Changed my mind');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await screen.findByText('Changed my mind');

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(await screen.findByRole('combobox')).toHaveValue('');
  });
});

describe('useConfirm outside a provider', () => {
  it('fails loudly rather than silently doing nothing', () => {
    const Orphan = () => {
      useConfirm();
      return null;
    };

    // React logs the error boundary trace; the assertion is what matters.
    expect(() => render(<Orphan />)).toThrow(/ConfirmProvider/);
  });
});
