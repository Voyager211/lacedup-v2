/**
 * Refuses to seed anything that could be a real database.
 *
 * Seeding wipes and rewrites collections, so the default is to allow only a
 * MongoDB on this machine. A remote host has to be named, exactly, in
 * SEED_ALLOW_REMOTE_HOST; nothing is ever seeded under NODE_ENV=production.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export class UnsafeSeedTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeSeedTargetError';
  }
}

/** Host names from a connection string, without credentials or ports. */
export const hostsOf = (uri: string): string[] => {
  const match = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri);
  if (!match) throw new UnsafeSeedTargetError('The seed target is not a MongoDB connection string');

  return match[2]!.split(',').map((host) => {
    const ipv6 = /^\[([^\]]+)\]/.exec(host);
    if (ipv6) return ipv6[1]!.toLowerCase();
    return host.replace(/:\d+$/, '').toLowerCase();
  });
};

export const assertSafeSeedTarget = (
  uri: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): void => {
  if (env.NODE_ENV === 'production') {
    throw new UnsafeSeedTargetError('Refusing to seed with NODE_ENV=production');
  }

  if (!uri) {
    throw new UnsafeSeedTargetError('No database to seed: set SEED_MONGODB_URI or MONGODB_URI');
  }

  const allowed = (env.SEED_ALLOW_REMOTE_HOST ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  const remote = hostsOf(uri).filter((host) => !LOCAL_HOSTS.has(host) && !allowed.includes(host));

  if (remote.length > 0) {
    throw new UnsafeSeedTargetError(
      `Refusing to seed a remote database (${remote.join(', ')}). ` +
        'Seed a local MongoDB (npm run db:local), or name the host in SEED_ALLOW_REMOTE_HOST ' +
        'if it is definitely not production.'
    );
  }
};
