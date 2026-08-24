import { useState } from 'react';
import Badge, {
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  paymentMethodTone
} from '@/components/Badge';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import Spinner from '@/components/Spinner';
import { SkeletonGrid } from '@/components/Skeleton';
import OtpInput from '@/components/form/OtpInput';
import PasswordField from '@/components/form/PasswordField';
import { SelectField, TextAreaField, TextField } from '@/components/form/TextField';
import { useConfirm, usePrompt } from '@/components/confirm/useConfirm';
import { useToast } from '@/components/toast';
import { formatDate, formatINR } from '@/lib/format';
import { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHODS } from '@/types/domain';

/**
 * A live gallery of the shared components.
 *
 * Dev-only, mounted at /_gallery. It exists so the primitives can be looked at
 * and clicked before any page consumes them - which is when design problems
 * are cheapest to fix - and so a later change can be eyeballed against every
 * variant at once rather than hunted for across pages.
 */

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-line py-8">
    <h2 className="mb-5 font-heading text-sm font-semibold uppercase tracking-widest text-ink-muted">
      {title}
    </h2>
    {children}
  </section>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3">{children}</div>
);

const Gallery = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();

  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(7);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [boundary, setBoundary] = useState<'ok' | 'loading' | 'error' | 'empty'>('ok');

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-heading text-3xl font-semibold text-ink">Component gallery</h1>
      <p className="mt-2 text-ink-muted">
        The shared primitives from step 1. Development only.
      </p>

      <Section title="Buttons">
        <Row>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </Row>
        <Row>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </Row>
      </Section>

      <Section title="Order status badges">
        <Row>
          {Object.values(ORDER_STATUS).map((status) => (
            <Badge key={status} tone={ORDER_STATUS_TONE[status]}>
              {status}
            </Badge>
          ))}
        </Row>
      </Section>

      <Section title="Payment status badges (bold)">
        <Row>
          {Object.values(PAYMENT_STATUS).map((status) => (
            <Badge key={status} tone={PAYMENT_STATUS_TONE[status]} variant="bold">
              {status}
            </Badge>
          ))}
        </Row>
      </Section>

      <Section title="Payment methods">
        <Row>
          {Object.values(PAYMENT_METHODS).map((method) => (
            <Badge key={method} tone={paymentMethodTone(method)} uppercase fixedWidth>
              {method}
            </Badge>
          ))}
        </Row>
      </Section>

      <Section title="Toasts">
        <Row>
          <Button size="sm" onClick={() => toast.success('Added to cart')}>
            Success
          </Button>
          <Button size="sm" variant="danger" onClick={() => toast.error('Out of stock')}>
            Error
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.warning('Only 2 left')}>
            Warning
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.info('Prices updated')}>
            Info
          </Button>
        </Row>
      </Section>

      <Section title="Confirm and prompt">
        <Row>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              const ok = await confirm({
                title: 'Cancel this order?',
                message: 'The refund goes back to your wallet within a few minutes.',
                confirmLabel: 'Cancel order',
                cancelLabel: 'Keep it',
                tone: 'danger'
              });
              toast.info(ok ? 'Confirmed' : 'Dismissed');
            }}
          >
            Confirm
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const reason = await prompt({
                title: 'Why are you cancelling?',
                options: ['Ordered by mistake', 'Found a better price elsewhere', 'Changed my mind'],
                confirmLabel: 'Cancel order',
                tone: 'danger'
              });
              toast.info(reason ? `Reason: ${reason}` : 'Dismissed');
            }}
          >
            Reason picker
          </Button>

          <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
            Modal
          </Button>
        </Row>
      </Section>

      <Section title="Form fields">
        <div className="grid max-w-md gap-5">
          <TextField label="Email" type="email" placeholder="you@example.com" required />
          <TextField label="Phone" error="Enter a valid 10-digit mobile number" defaultValue="123" />
          <PasswordField
            label="New password"
            showStrength
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="At least 8 characters, with a letter and a number"
          />
          <SelectField
            label="Address type"
            placeholder="Choose one…"
            options={[
              { value: 'Home', label: 'Home' },
              { value: 'Work', label: 'Work' },
              { value: 'Other', label: 'Other' }
            ]}
          />
          <TextAreaField label="Message" placeholder="How can we help?" />
          <OtpInput value={otp} onChange={setOtp} onComplete={() => toast.success('Code entered')} />
        </div>
      </Section>

      <Section title="Pagination">
        <Pagination currentPage={page} totalPages={20} onPageChange={setPage} />
        <p className="mt-3 text-center text-sm text-ink-muted">Page {page} of 20</p>
      </Section>

      <Section title="Query states">
        <Row>
          {(['ok', 'loading', 'error', 'empty'] as const).map((state) => (
            <Button
              key={state}
              size="sm"
              variant={boundary === state ? 'primary' : 'outline'}
              onClick={() => setBoundary(state)}
            >
              {state}
            </Button>
          ))}
        </Row>

        <div className="mt-5 rounded-lg border border-line bg-white p-5">
          <QueryBoundary
            isLoading={boundary === 'loading'}
            error={boundary === 'error' ? new Error('Network request failed') : undefined}
            isEmpty={boundary === 'empty'}
            skeleton={<SkeletonGrid count={4} />}
            empty={<EmptyState title="No products found" message="Try clearing your filters." />}
            onRetry={() => setBoundary('ok')}
          >
            <p className="text-ink">Loaded content renders here.</p>
          </QueryBoundary>
        </div>
      </Section>

      <Section title="Formatting">
        <dl className="grid gap-2 font-mono text-sm">
          {[
            ['formatINR(1234567)', formatINR(1234567)],
            ['formatINR(1299)', formatINR(1299)],
            ['formatINR(1299.5)', formatINR(1299.5)],
            ['formatINR(null)', formatINR(null)],
            ['formatDate(now)', formatDate(new Date())]
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-56 shrink-0 text-ink-muted">{label}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Spinner">
        <Row>
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </Row>
      </Section>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="A dialog"
        description="Focus is trapped, Escape closes, and focus returns to the trigger."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setModalOpen(false)}>Save</Button>
          </>
        }
      >
        <p className="text-ink-muted">
          Replaces 45 bootstrap.Modal instantiations across 24 distinct ids.
        </p>
      </Modal>
    </div>
  );
};

export default Gallery;
