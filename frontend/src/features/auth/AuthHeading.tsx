/** Shared heading for the auth card, so the six pages stay visually identical. */
const AuthHeading = ({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) => (
  <header className="mb-6 text-center">
    <h1 className="font-heading text-2xl font-semibold text-ink">{title}</h1>
    {subtitle && <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>}
  </header>
);

export default AuthHeading;
