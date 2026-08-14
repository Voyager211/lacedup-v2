import { Link } from 'react-router-dom';
import { BsPatchCheck, BsStars, BsLightning, BsPeople } from 'react-icons/bs';
import Button from '@/components/Button';

/**
 * About.
 *
 * Ported from `user/about.ejs` (759 lines, the great majority of it inline
 * CSS re-declaring what the design tokens already provide). The copy is
 * carried across verbatim; the layout is rebuilt with the shared tokens rather
 * than a per-page stylesheet.
 */

const VALUES = [
  {
    title: 'Authenticity guaranteed',
    body: 'Every pair is 100% authentic, sourced from trusted suppliers and verified by our team. We stand behind every sneaker we sell with complete transparency.'
  },
  {
    title: 'Curated selection',
    body: 'From timeless classics to the latest hype releases, our collection is handpicked to represent the best of sneaker culture across all styles and brands.'
  },
  {
    title: 'Style elevation',
    body: "We're here to help you find kicks that match your vibe, upgrade your rotation, and express your unique style—because great sneakers are more than a purchase, they're an investment in yourself."
  }
];

const PROMISE = [
  {
    icon: BsPatchCheck,
    title: '100% authentic',
    body: 'Every sneaker is verified for authenticity. No fakes, no replicas—just the real deal.'
  },
  {
    icon: BsLightning,
    title: 'Latest releases',
    body: 'Stay ahead of the game with access to the newest drops and exclusive collaborations.'
  },
  {
    icon: BsStars,
    title: 'Passion-driven service',
    body: "We're sneakerheads first, retailers second. Expect advice, recommendations, and genuine enthusiasm."
  },
  {
    icon: BsPeople,
    title: 'Community focus',
    body: 'Join a community of like-minded sneaker enthusiasts who share your passion for the culture.'
  }
];

const AboutPage = () => (
  <div>
    <header className="bg-ink px-4 py-16 text-center text-white">
      <p className="font-heading text-sm tracking-[0.2em] text-white/70">WHERE STYLE MEETS PASSION</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold">About LacedUp</h1>
      <p className="mt-3 text-white/80">Elevating sneaker culture, one step at a time</p>
    </header>

    <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
      <section>
        <h2 className="font-heading text-2xl font-semibold text-ink">Our story</h2>
        <div className="mt-4 space-y-4 leading-relaxed text-ink-muted">
          <p>
            LacedUp was born from a deep passion for sneaker culture and a belief that the right
            pair of kicks can transform not just your outfit, but your entire attitude. In a world
            where sneakers have become more than footwear—they&apos;re a statement, an identity, a
            lifestyle—we saw the need for a destination that truly understands sneakerheads.
          </p>
          <p>
            We&apos;re not just another sneaker retailer. We&apos;re curators of style, collectors
            of the freshest drops, and guides for those looking to elevate their game. From iconic
            classics to limited releases, every sneaker in our collection is handpicked for its
            quality, authenticity, and cultural impact.
          </p>
          <p>
            Whether you&apos;re a seasoned collector hunting for grails or someone taking their
            first steps into sneaker culture, LacedUp is your destination. Because we believe that
            everyone deserves to walk in confidence, style, and authenticity.
          </p>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-2xl font-semibold text-ink">Meet the founder</h2>

        <div className="mt-4 rounded-lg border border-line bg-white p-6">
          <p className="font-heading text-lg font-semibold text-ink">Mohammed Al Fahad</p>
          <p className="text-sm text-ink-muted">Full stack developer · Sneakerhead</p>

          <h3 className="mt-6 font-heading text-lg font-semibold text-ink">
            Built by sneakerheads, for sneakerheads
          </h3>

          <div className="mt-3 space-y-4 leading-relaxed text-ink-muted">
            <p>
              My journey with sneakers began years ago, but it&apos;s evolved into something much
              deeper than just collecting kicks. I&apos;ve spent countless nights camping out for
              releases, trading rare finds, and building a rotation that tells my story. Every pair
              in my collection represents a moment, a memory, or a milestone.
            </p>
            <p>
              As a web developer and sneaker enthusiast, I saw an opportunity to merge two of my
              biggest passions. LacedUp isn&apos;t just an e-commerce platform—it&apos;s a carefully
              crafted digital experience built from the ground up with the same attention to detail
              I give to choosing sneakers. From the backend architecture to the user interface,
              every line of code reflects my commitment to quality and authenticity.
            </p>
            <p>
              I created LacedUp to bring that same passion to every customer. Each sneaker is
              personally selected based on quality, authenticity, and cultural relevance. Whether
              you&apos;re a seasoned collector or just starting your sneaker journey, I&apos;m here
              to help you find the kicks that speak to your style and story.
            </p>
            <p>
              Building web applications has taught me the importance of user experience, and that
              philosophy carries over to how I run LacedUp. Every feature, every product
              description, every interaction is designed to make your shopping experience as smooth
              as breaking in a fresh pair of kicks.
            </p>
          </div>

          <blockquote className="mt-6 border-l-2 border-brand pl-4 italic text-ink">
            &ldquo;Sneakers aren&apos;t just shoes. They&apos;re art, history, and self-expression
            all laced into one.&rdquo;
          </blockquote>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-2xl font-semibold text-ink">What we stand for</h2>
        <p className="mt-2 text-ink-muted">
          At LacedUp, every sneaker represents quality, authenticity, and the spirit of sneaker
          culture.
        </p>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {VALUES.map((value) => (
            <div key={value.title} className="rounded-lg border border-line bg-white p-5">
              <h3 className="font-heading font-semibold text-ink">{value.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{value.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-2xl font-semibold text-ink">The LacedUp promise</h2>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {PROMISE.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3 rounded-lg border border-line bg-white p-5">
              <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <div>
                <h3 className="font-heading font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-card p-8 text-center">
        <h2 className="font-heading text-2xl font-semibold text-ink">Ready to step up?</h2>
        <p className="mx-auto mt-2 max-w-2xl text-ink-muted">
          Explore our curated collection of premium sneakers and find your next grail. Whether
          you&apos;re building your rotation or hunting for that one special pair, we&apos;ve got
          you covered.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/shop">
            <Button>Browse collection</Button>
          </Link>
          <Link to="/help">
            <Button variant="outline">Get style advice</Button>
          </Link>
        </div>
      </section>
    </div>
  </div>
);

export default AboutPage;
