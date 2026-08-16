import { Link } from 'react-router-dom';
import { Banknote, CreditCard, Wallet } from 'lucide-react';
import Logo from '@/components/Logo';

/**
 * The storefront footer.
 *
 * Laid out to the design: the mark and tagline, three link columns, then a rule
 * and a bottom row carrying the copyright, the payment methods and the policy
 * links.
 *
 * Where the design's links have no page behind them they point at the page that
 * answers them rather than at a 404 - 11 of the EJS footer's 15 links pointed
 * at routes that were never mounted, and every one of them 404'd. /help holds
 * the FAQ accordion and the contact form, which is where shipping, returns and
 * payment questions are actually answered.
 *
 * Two deliberate departures from the design, both flagged rather than faked:
 *
 *  - The payment row shows what the checkout actually takes: card (Razorpay),
 *    wallet and cash on delivery. The design shows PayPal and Apple Pay; the
 *    PayPal integration is inert - the controller hardcodes an empty client id -
 *    and there is no Apple Pay at all. Advertising a payment method that will
 *    not appear at checkout is worse than an incomplete row.
 *  - The social icons are omitted. There are no accounts behind them, and
 *    pointing them at a guessed handle risks sending shoppers to someone
 *    else's page. They go back the moment there are real URLs.
 */

const COLUMNS = [
  {
    heading: 'Shop',
    links: [
      { to: '/shop?sort=newest', label: 'New Arrivals' },
      { to: '/shop?sort=popularity', label: 'Bestsellers' },
      { to: '/shop', label: 'Sneakers' },
      { to: '/shop?sort=priceHigh', label: 'Limited Editions' }
    ]
  },
  {
    heading: 'About',
    links: [
      { to: '/about', label: 'Our Story' },
      { to: '/about', label: 'Culture' },
      { to: '/about', label: 'Events' },
      { to: '/about', label: 'Careers' }
    ]
  },
  {
    heading: 'Customer Service',
    links: [
      { to: '/help', label: 'Contact' },
      { to: '/help', label: 'FAQs' },
      { to: '/help', label: 'Shipping & Returns' },
      { to: '/help', label: 'Payment & Policies' }
    ]
  }
] as const;

/** What the checkout actually accepts. See the note above. */
const PAYMENTS = [
  { icon: CreditCard, label: 'Card' },
  { icon: Wallet, label: 'Wallet' },
  { icon: Banknote, label: 'Cash on delivery' }
] as const;

const POLICIES = [
  { to: '/help', label: 'Privacy Policy' },
  { to: '/help', label: 'Terms of Service' },
  { to: '/help', label: 'Cookie Policy' }
] as const;

const Footer = () => (
  <footer className="bg-ink text-white">
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo onDark width={150} />
          <p className="mt-5 text-sm font-bold uppercase tracking-wider text-white">
            Where style meets street culture
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <h2 className="font-heading text-base font-bold text-white">{column.heading}</h2>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={`${column.heading}-${link.label}`}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mt-12 border-t border-white/10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-white/60">
            © {new Date().getFullYear()} LacedUp Co. All rights reserved.
          </p>

          <ul className="flex items-center gap-4" aria-label="Payment methods we accept">
            {PAYMENTS.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon className="size-5 text-white/70" aria-hidden="true" />
                <span className="sr-only">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Policies" className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-2">
          {POLICIES.map((policy) => (
            <Link
              key={policy.label}
              to={policy.to}
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              {policy.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  </footer>
);

export default Footer;
