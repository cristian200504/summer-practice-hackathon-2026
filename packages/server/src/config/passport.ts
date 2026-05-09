import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { env } from './env';
import { findUserByOAuth, createOAuthUser } from '../repositories/userRepository';

/**
 * Configure Passport.js with the Google OAuth 2.0 strategy.
 *
 * On first login: creates a new user account via createOAuthUser.
 * On subsequent logins: looks up the existing user via findUserByOAuth.
 *
 * The verified user object is attached to req.user by Passport.
 */
export function configurePassport(): void {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (error: Error | null, user?: Express.User | false) => void,
      ) => {
        try {
          const googleId = profile.id;
          const email =
            profile.emails && profile.emails.length > 0
              ? profile.emails[0].value
              : `${googleId}@google.oauth`;

          // Look up existing user by OAuth provider + ID
          let user = await findUserByOAuth('google', googleId);

          if (!user) {
            // First OAuth login — create a new account
            user = await createOAuthUser(email, 'google', googleId);
          }

          return done(null, user);
        } catch (err) {
          return done(err instanceof Error ? err : new Error(String(err)));
        }
      },
    ),
  );

  // Passport requires serialize/deserialize even when not using sessions.
  // We use stateless JWT so these are minimal stubs.
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user as Express.User);
  });
}
