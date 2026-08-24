import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Badge, { ORDER_STATUS_TONE, PAYMENT_STATUS_TONE, paymentMethodTone } from './Badge';
import Button from './Button';
import Pagination from './Pagination';
import QueryBoundary from './QueryBoundary';
import OtpInput from './form/OtpInput';
import { passwordStrength } from './form/PasswordField';
import { ORDER_STATUS, PAYMENT_STATUS } from '@/types/domain';

describe('Button', () => {
  it('cannot be clicked while loading', async () => {
    // The EJS pages routinely showed a spinner and left the button live, which
    // is how duplicate orders happen.
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Place order</Button>);

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('keeps its label visible while loading', () => {
    render(<Button loading>Place order</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Place order');
  });

  it('defaults to type="button" so it cannot submit a form by accident', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Badge tone maps', () => {
  it('covers every order status', () => {
    for (const status of Object.values(ORDER_STATUS)) {
      expect(ORDER_STATUS_TONE[status]).toBeDefined();
    }
  });

  it('covers every payment status', () => {
    for (const status of Object.values(PAYMENT_STATUS)) {
      expect(PAYMENT_STATUS_TONE[status]).toBeDefined();
    }
  });

  it('keeps the pairings the stylesheets used', () => {
    expect(ORDER_STATUS_TONE[ORDER_STATUS.PARTIALLY_DELIVERED]).toBe('info');
    expect(ORDER_STATUS_TONE[ORDER_STATUS.SHIPPED]).toBe('info');
    expect(ORDER_STATUS_TONE[ORDER_STATUS.DELIVERED]).toBe('success');
    expect(PAYMENT_STATUS_TONE[PAYMENT_STATUS.PARTIALLY_REFUNDED]).toBe('purple');
  });

  it('maps payment methods case-insensitively and falls back for unknowns', () => {
    expect(paymentMethodTone('COD')).toBe('warning');
    expect(paymentMethodTone('online')).toBe('primary');
    expect(paymentMethodTone('wallet')).toBe('success');
    expect(paymentMethodTone('bitcoin')).toBe('secondary');
    expect(paymentMethodTone(null)).toBe('secondary');
  });

  it('renders its content', () => {
    render(<Badge tone="success">Delivered</Badge>);
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the current page for assistive tech', () => {
    render(<Pagination currentPage={3} totalPages={10} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
  });

  it('reports the chosen page', async () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={10} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Page 4' }));

    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('does not re-fetch the page already shown', async () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={10} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Page 3' }));

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('disables the arrows at each end', () => {
    const { rerender } = render(
      <Pagination currentPage={1} totalPages={10} onPageChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    rerender(<Pagination currentPage={10} totalPages={10} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});

describe('QueryBoundary', () => {
  it('shows the skeleton while loading', () => {
    render(
      <QueryBoundary isLoading skeleton={<p>skeleton</p>}>
        <p>content</p>
      </QueryBoundary>
    );

    expect(screen.getByText('skeleton')).toBeInTheDocument();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('surfaces the backend message on an error', () => {
    render(
      <QueryBoundary isLoading={false} error={new Error('Network request failed')}>
        <p>content</p>
      </QueryBoundary>
    );

    expect(screen.getByText(/network request failed/i)).toBeInTheDocument();
  });

  it('offers a retry when one is available', async () => {
    const onRetry = vi.fn();
    render(
      <QueryBoundary isLoading={false} error={new Error('nope')} onRetry={onRetry}>
        <p>content</p>
      </QueryBoundary>
    );

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('prefers loading over a stale error, so a retry shows progress', () => {
    render(
      <QueryBoundary isLoading error={new Error('nope')} skeleton={<p>skeleton</p>}>
        <p>content</p>
      </QueryBoundary>
    );

    expect(screen.getByText('skeleton')).toBeInTheDocument();
  });

  it('shows the empty state when there is nothing to render', () => {
    render(
      <QueryBoundary isLoading={false} isEmpty empty={<p>nothing here</p>}>
        <p>content</p>
      </QueryBoundary>
    );

    expect(screen.getByText('nothing here')).toBeInTheDocument();
  });

  it('renders children once loaded and non-empty', () => {
    render(
      <QueryBoundary isLoading={false}>
        <p>content</p>
      </QueryBoundary>
    );

    expect(screen.getByText('content')).toBeInTheDocument();
  });
});

describe('OtpInput', () => {
  // OtpInput is controlled, so the tests need something to hold the value.
  const Harness = ({ onComplete }: { onComplete?: (value: string) => void }) => {
    const [value, setValue] = useState('');
    return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />;
  };

  it('advances as digits are typed', async () => {
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox');

    await userEvent.type(boxes[0]!, '1');
    expect(boxes[1]).toHaveFocus();
  });

  it('fires onComplete when the last box is filled', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    await userEvent.type(screen.getAllByRole('textbox')[0]!, '123456');

    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('accepts a pasted code, which none of the three originals did', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    const boxes = screen.getAllByRole('textbox');
    boxes[0]!.focus();
    await userEvent.paste('654321');

    expect(onComplete).toHaveBeenCalledWith('654321');
  });

  it('ignores non-digits', async () => {
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox');

    await userEvent.type(boxes[0]!, 'a');

    expect(boxes[0]).toHaveValue('');
  });

  it('steps back on backspace in an empty box', async () => {
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox');

    // Typing two digits leaves focus on the third, empty box. Backspace there
    // should clear the previous digit rather than doing nothing.
    await userEvent.type(boxes[0]!, '12');
    await userEvent.keyboard('{Backspace}');

    expect(boxes[0]).toHaveValue('1');
    expect(boxes[1]).toHaveValue('');
    expect(boxes[1]).toHaveFocus();
  });

  it('clears the current box when it still holds a digit', async () => {
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox');

    await userEvent.type(boxes[0]!, '12');
    await userEvent.click(boxes[1]!);
    await userEvent.keyboard('{Backspace}');

    expect(boxes[0]).toHaveValue('1');
    expect(boxes[1]).toHaveValue('');
  });
});

describe('passwordStrength', () => {
  it.each([
    ['', 0],
    ['abc', 0],
    ['abcdefgh', 1],
    ['abcdefghijkl', 2],
    ['Abcdefghijkl', 3],
    ['Abcdefghij1!', 4]
  ])('scores %s as %i', (password, score) => {
    expect(passwordStrength(password).score).toBe(score);
  });

  it('rates a long passphrase above a short string of mixed characters', () => {
    // Scoring character classes alone would call these equal, which is
    // backwards - length is what resists a brute force.
    expect(passwordStrength('aaaaaaaaaaaaaaaaaaaa').score).toBeGreaterThan(
      passwordStrength('aB1!').score
    );
  });
});
