import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import type { PassportStatic } from 'passport';
import User from '../users/user.model';

/**
 * Passport wiring.
 *
 * The Facebook strategy is intentionally absent - it was commented out in the
 * original and its FB_CLIENT_ID / FB_CLIENT_SECRET are documented as optional
 * in .env.example. It is not carried over as dead code.
 */
export = function configurePassport(passport: PassportStatic): void {
  // Local strategy
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user) return done(null, false, { message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false, { message: 'Invalid credentials' });

        // Blocked accounts are refused even with correct credentials.
        if (user.isBlocked) {
          return done(null, false, {
            message: 'Your account has been blocked. Please contact support.'
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  // Google strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',

        /**
         * Where Google sends the browser back to.
         *
         * Relative in development, which passport resolves against the host of
         * the request - correct when that host is the one the visitor is on.
         *
         * In a split deployment it is not. The visitor is on the Vercel domain,
         * which rewrites /google here, so the request arrives carrying Render's
         * host; resolving against it would land the browser on the API domain
         * after consent, where the login cookie would be set on a domain the
         * app is not served from and the redirect to /home would 404. Setting
         * this to the public origin sends them back through Vercel instead, so
         * the cookie is set where it is needed. The value must also be listed
         * verbatim as an authorised redirect URI in the Google console.
         *
         * `||` rather than `??`, because the thing this guards against is not
         * an unset variable but an empty one. A host that asks for every value
         * up front - Render's blueprint form does - creates the key with an
         * empty string when it is left blank, which `??` treats as a real
         * value and hands to passport as `callbackURL: ''`. That is not the
         * relative default; it is no redirect_uri at all.
         */
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/google/callback'
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            user = await User.create({
              name: profile.displayName,
              email: profile.emails?.[0]?.value ?? '',
              googleId: profile.id,
              password: 'unused'
            });
          }

          if (user.isBlocked) {
            return done(null, false, {
              message: 'Your account has been blocked. Please contact support.'
            });
          }

          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  // Serialize with the role alongside the id, which is what keeps admin and
  // shopper sessions distinguishable.
  passport.serializeUser((user: any, done) => {
    done(null, { id: user.id, role: user.role });
  });

  passport.deserializeUser(async (data: any, done) => {
    try {
      const user = await User.findById(data.id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
