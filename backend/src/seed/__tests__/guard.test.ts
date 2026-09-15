import { assertSafeSeedTarget, hostsOf, UnsafeSeedTargetError } from '../guard';

describe('hostsOf', () => {
  it('strips credentials and ports from every host in a replica set', () => {
    expect(hostsOf('mongodb://user:p%40ss@a.example.net:27017,b.example.net:27017/lacedup?ssl=true')).toEqual([
      'a.example.net',
      'b.example.net'
    ]);
  });

  it('reads srv and IPv6 hosts', () => {
    expect(hostsOf('mongodb+srv://u:p@cluster0.abc.mongodb.net/lacedup')).toEqual(['cluster0.abc.mongodb.net']);
    expect(hostsOf('mongodb://[::1]:27017/lacedup')).toEqual(['::1']);
  });

  it('rejects anything that is not a MongoDB connection string', () => {
    expect(() => hostsOf('postgres://localhost/lacedup')).toThrow(UnsafeSeedTargetError);
  });
});

describe('assertSafeSeedTarget', () => {
  it('allows a local database', () => {
    expect(() => assertSafeSeedTarget('mongodb://127.0.0.1:27017/lacedup', {})).not.toThrow();
    expect(() => assertSafeSeedTarget('mongodb://localhost/lacedup', {})).not.toThrow();
  });

  it('refuses under NODE_ENV=production, even locally', () => {
    expect(() => assertSafeSeedTarget('mongodb://127.0.0.1/lacedup', { NODE_ENV: 'production' })).toThrow(
      /production/
    );
  });

  it('refuses when there is no connection string', () => {
    expect(() => assertSafeSeedTarget(undefined, {})).toThrow(UnsafeSeedTargetError);
  });

  it('refuses an Atlas cluster by default', () => {
    expect(() =>
      assertSafeSeedTarget('mongodb+srv://u:p@cluster0.abc.mongodb.net/lacedup', {})
    ).toThrow(/remote database \(cluster0\.abc\.mongodb\.net\)/);
  });

  it('refuses a replica set with one remote member among local ones', () => {
    expect(() =>
      assertSafeSeedTarget('mongodb://127.0.0.1:27017,db.example.net:27017/lacedup', {})
    ).toThrow(/db\.example\.net/);
  });

  it('allows a remote host only when it is named exactly', () => {
    const uri = 'mongodb+srv://u:p@staging.abc.mongodb.net/lacedup';

    expect(() => assertSafeSeedTarget(uri, { SEED_ALLOW_REMOTE_HOST: 'staging.abc.mongodb.net' })).not.toThrow();
    expect(() => assertSafeSeedTarget(uri, { SEED_ALLOW_REMOTE_HOST: 'abc.mongodb.net' })).toThrow();
  });

  it('does not let the allow-list override NODE_ENV=production', () => {
    const uri = 'mongodb+srv://u:p@staging.abc.mongodb.net/lacedup';

    expect(() =>
      assertSafeSeedTarget(uri, { NODE_ENV: 'production', SEED_ALLOW_REMOTE_HOST: 'staging.abc.mongodb.net' })
    ).toThrow(/production/);
  });
});
