import { Quote, User } from 'lucide-react';
import SectionHeading from '@/components/SectionHeading';

/**
 * What our sneakerheads say.
 *
 * The quotes are fixed copy, not data: there is no reviews collection behind
 * them and inventing an endpoint to serve three hardcoded strings would only
 * hide that. When real reviews exist this becomes a query and the shape below
 * is what it should return.
 *
 * The avatars are the same placeholder mark the design uses rather than stock
 * photographs of people who never said any of this. A photograph would read as
 * a real customer; a glyph reads as a placeholder, which is what it is.
 */

interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'LacedUp Co. made sneaker shopping so smooth! Their picks always feel like they were chosen just for me.',
    name: 'Emily Richards',
    role: 'Sneaker Enthusiast'
  },
  {
    quote: "Never thought I'd find limited editions this easily. From drop to doorstep, it's a vibe!",
    name: 'Jordan Miles',
    role: 'Streetwear Collector'
  },
  {
    quote:
      'Their customer service? On point. The styles? Fire. I’m always checking for what’s next.',
    name: 'Tasha Boone',
    role: 'Kick Connoisseur'
  }
];

const Testimonials = () => (
  <section className="bg-card/40 py-16 sm:py-20">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <SectionHeading>What Our Sneakerheads Say:</SectionHeading>

      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((testimonial) => (
          <li
            key={testimonial.name}
            className="flex flex-col rounded-xl bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
            <Quote className="size-7 shrink-0 fill-ink text-ink" aria-hidden="true" />

            <blockquote className="mt-4 flex-1 text-ink-muted">
              &ldquo;{testimonial.quote}&rdquo;
            </blockquote>

            <div className="mt-6 flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card">
                <User className="size-5 text-ink-muted" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{testimonial.name}</p>
                <p className="truncate text-sm text-ink-muted">{testimonial.role}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default Testimonials;
