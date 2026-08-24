import { useState, type FormEvent } from 'react';
import { useSubscribeMutation } from './content.api';
import { useToast } from '@/components/toast';
import { cn } from '@/lib/cn';

/**
 * Join our sneaker community.
 *
 * The signup posts to `/newsletter/subscribe` and the address is stored. That
 * endpoint was written for this section: a form that thanks you and discards
 * what you typed is the kind of dead control this rewrite has been removing,
 * and it is not visible from the outside which kind you are looking at.
 *
 * Consent is required before the button will submit, rather than being a tick
 * nobody reads - an address collected without it is one that cannot be mailed,
 * so taking it anyway would only build a list that cannot be used.
 */

const IMAGE =
  'https://res.cloudinary.com/daqfxkc3u/image/upload/f_auto,q_auto,w_1200/v1750335604/47aed604c4ef19dccada1b584c0e52de_xfr2kf.jpg';

const CommunityJoin = () => {
  const toast = useToast();
  const [subscribe, { isLoading }] = useSubscribeMutation();

  const [email, setEmail] = useState('');
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!consented) {
      setError('Tick the box to say we can email you.');
      return;
    }

    try {
      const result = await subscribe({ email: email.trim(), consented }).unwrap();
      toast.success(result.message ?? "You're on the list");
      setEmail('');
      setConsented(false);
    } catch (caught) {
      // The server checks the address too, and its message names the problem.
      toast.fromError(caught, 'Could not sign you up just now.');
    }
  };

  return (
    <section className="bg-ink py-16 text-white sm:py-20">
      {/*
        The copy sits in the left column rather than above both, so the two
        centre against each other. Left outside, the heading pushed the image
        down its own height and the form ended up floating at the top of a
        column two-thirds empty.
      */}
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-14">
        <div>
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Join Our Sneaker Community
          </h2>
          <p className="mt-4 max-w-xl text-white/70">
            Subscribe to receive exclusive offers, early access to new drops, and personalized
            sneaker recommendations.
          </p>

          <form onSubmit={onSubmit} noValidate className="mt-7">
            <div className="flex overflow-hidden rounded-lg bg-card">
              <label htmlFor="newsletter-email" className="sr-only">
                Your email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                autoComplete="email"
                placeholder="Your email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-w-0 flex-1 bg-transparent px-5 py-3.5 text-ink outline-none placeholder:text-ink-muted"
              />
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  'shrink-0 bg-brand px-6 py-3.5 font-medium text-white transition-colors',
                  'hover:bg-brand-hover disabled:pointer-events-none disabled:opacity-60'
                )}
              >
                {isLoading ? 'Joining…' : 'Subscribe'}
              </button>
            </div>

            <label className="mt-4 flex items-start gap-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) => {
                  setConsented(event.target.checked);
                  setError(null);
                }}
                className="mt-0.5 size-4 shrink-0 accent-brand"
              />
              I agree to receive marketing emails from LacedUp Co.
            </label>

            {error && (
              <p role="alert" className="mt-3 text-sm text-brand">
                {error}
              </p>
            )}
          </form>
        </div>

        <img
          src={IMAGE}
          alt="Sneakerheads together on a rooftop"
          loading="lazy"
          className="w-full rounded-lg object-cover"
        />
      </div>
    </section>
  );
};

export default CommunityJoin;
