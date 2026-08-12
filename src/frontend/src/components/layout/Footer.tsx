import { Link } from 'react-router-dom';

/**
 * The storefront footer.
 *
 * 11 of the 15 links in the EJS footer pointed at routes that are not mounted:
 * /categories, /contact, /faq, /returns, /terms, /privacy and /cookies. Every
 * one of them 404'd.
 *
 * Rather than port dead links, each was resolved to a real destination:
 *
 *  - Shop links go to /shop, with the filters they describe where one exists.
 *  - Contact, FAQs, Shipping & Returns and Payment & Policies all go to /help,
 *    which is the page that actually holds the FAQ accordion and the contact
 *    form.
 *  - Privacy Policy, Terms of Service and Cookie Policy are OMITTED. There is
 *    no content behind them anywhere in the codebase, and a link to a legal
 *    page that does not exist is worse than no link. They belong back here as
 *    soon as the pages are written - see the README's open items.
 *  - The social icons were `href="#"` placeholders with no accounts behind
 *    them, so they are omitted too.
 */
const COLUMNS = [
  {
    heading: 'Shop',
    links: [
      { to: '/shop?sort=newest', label: 'New arrivals' },
      { to: '/shop?sort=popular', label: 'Bestsellers' },
      { to: '/shop', label: 'All sneakers' }
    ]
  },
  {
    heading: 'About',
    links: [
      { to: '/about', label: 'Our story' },
      { to: '/about', label: 'Culture' }
    ]
  },
  {
    heading: 'Customer service',
    links: [
      { to: '/help', label: 'Contact us' },
      { to: '/help', label: 'FAQs' },
      { to: '/help', label: 'Shipping & returns' },
      { to: '/orders', label: 'Track an order' }
    ]
  }
] as const;

const Footer = () => (
  <footer className="mt-16 bg-ink text-white">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-2xl tracking-wide">LACEDUP</p>
          <p className="mt-3 max-w-xs text-sm text-white/60">
            Where style meets street culture.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50">
              {column.heading}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={`${column.heading}-${link.label}`}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/80 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mt-10 border-t border-white/10 pt-6">
        <p className="text-sm text-white/50">
          © {new Date().getFullYear()} LacedUp Co.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
