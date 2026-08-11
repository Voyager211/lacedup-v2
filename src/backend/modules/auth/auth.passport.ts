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
        callbackURL: '/google/callback'
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
