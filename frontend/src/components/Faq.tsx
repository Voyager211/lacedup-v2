import { useState } from 'react';
import { BsChevronDown } from 'react-icons/bs';
import { cn } from '@/lib/cn';

/**
 * One question in an FAQ list.
 *
 * Lifted out of HelpPage unchanged when the About page needed the same thing,
 * so the two cannot drift into behaving differently - a disclosure that opens
 * one way on one page and another way elsewhere is the kind of difference
 * nobody notices until a screen reader user reports it.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export const Faq = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-line last:border-b-0">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-4 px-1 py-4 text-left font-medium text-ink transition-colors hover:text-brand"
        >
          {question}
          <BsChevronDown
            className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h3>

      {open && <p className="px-1 pb-4 text-sm leading-relaxed text-ink-muted">{answer}</p>}
    </div>
  );
};

/** The whole list, on the white card both pages present it in. */
export const FaqList = ({ items }: { items: readonly FaqItem[] }) => (
  <div className="rounded-lg border border-line bg-white px-5">
    {items.map((item) => (
      <Faq key={item.q} question={item.q} answer={item.a} />
    ))}
  </div>
);

export default Faq;
