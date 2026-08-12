import { Link, useParams } from 'react-router-dom';

/**
 * A stand-in for a page not yet built.
 *
 * Every route in the tree is wired to one of these so the router, the guards
 * and the layouts can be exercised end to end before any page exists. Each
 * carries the conversion step that will replace it, which doubles as a
 * progress board: when nothing renders a Placeholder any more, Phase 4 is done.
 */
interface PlaceholderProps {
  title: string;
  /** Conversion step from the README's ordering. */
  step: number;
  /** Roughly what has to be rebuilt, from the page inventory. */
  note?: string;
}

const Placeholder = ({ title, step, note }: PlaceholderProps) => {
  const params = useParams();
  const paramEntries = Object.entries(params).filter(([, value]) => value);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Step {step}</p>
      <h1 className="mt-2 font-heading text-3xl font-semibold text-ink">{title}</h1>

      {note && <p className="mt-4 text-ink-muted">{note}</p>}

      {paramEntries.length > 0 && (
        <dl className="mt-6 rounded-lg border border-line bg-card p-4 font-mono text-sm">
          {paramEntries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="text-ink-muted">{key}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-8 text-sm text-ink-muted">
        Not built yet. The spec for this page is in{' '}
        <code className="rounded bg-card px-1.5 py-0.5 font-mono text-xs">docs/</code>.{' '}
        <Link to="/" className="text-brand underline underline-offset-4 hover:text-brand-hover">
          Back home
        </Link>
      </p>
    </div>
  );
};

export default Placeholder;
