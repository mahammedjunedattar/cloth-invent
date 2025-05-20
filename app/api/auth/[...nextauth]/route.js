// pages/api/auth/[...nextauth].js
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import clientPromise from '@/app/lib/db'; // Make sure this path is correct

// 1. Zod schema for credentials validation
const credentialsSchema = z.object({
  email:     z.string().email('Invalid email format'),
  password:  z.string().min(6, 'Password must be at least 6 characters'),
});

// 2. NextAuth options
export const authOptions = {
  // 2a. MongoDBAdapter
  adapter: MongoDBAdapter(clientPromise, {
    databaseName: 'yourdb',
    collections: {
      Users:             'users',
      Sessions:          'sessions',
      Accounts:          'accounts',
      VerificationTokens: 'verification_tokens',
    },
  }),

  // 2b. Providers: Google + Credentials
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,       // Must be set in Netlify env
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,   // Must be set in Netlify env
      authorization: {
        params: {
          prompt:        'consent',
          access_type:   'offline',
          response_type: 'code',
        },
      },
    }),

    CredentialsProvider({
      id:   'credentials',
      name: 'Email / Password',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          // 2b-i. Validate the incoming credentials using Zod
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;

          // 2b-ii. Fetch the user from MongoDB
          const client = await clientPromise;
          const db     = client.db(); // Defaults to the DB in the URI if `MONGODB_DB` is undefined
          const user   = await db.collection('users').findOne({
            email: parsed.data.email.toLowerCase(),
          });

          // 2b-iii. If user not found or no password, return null
          if (!user?.password) return null;

          // 2b-iv. Compare hashed password with bcrypt
          const isValid = await bcrypt.compare(parsed.data.password, user.password);
          if (!isValid) return null;

          // 2b-v. Return the “user” object that becomes the JWT payload
          return {
            id:      user._id.toString(),
            email:   user.email,
            name:    user.name || 'User',
            storeId: user.storeId,
            role:    user.role || 'user',
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],

  // 2c. Session strategy: JSON Web Tokens (JWT)
  session: {
    strategy: 'jwt',
    maxAge:   24 * 60 * 60,   // 1 day
    updateAge: 6 * 60 * 60,   // 6 hours
  },

  // 2d. Callbacks to extend token/session with custom fields
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // 2d-i. On first sign in, attach storeId & role to the token
      if (user) {
        token.storeId = user.storeId;
        token.role    = user.role;
      }
      // 2d-ii. On session update request, keep storeId & role in token
      if (trigger === 'update' && session?.storeId) {
        token.storeId = session.storeId;
      }
      return token;
    },
    async session({ session, token }) {
      // 2d-iii. Attach storeId, role, and user.id to the session object
      session.user.storeId = token.storeId;
      session.user.role    = token.role;
      session.user.id      = token.sub;
      return session;
    },
  },

  // 2e. Custom Pages (optional, but recommended so you control the UI)
  pages: {
    signIn: '/login',       // Maps to pages/login.js or app/login/page.js
    error:  '/auth/error',  // Maps to pages/auth/error.js or app/auth/error/page.js
  },

  // 2f. Redirect callback: only allow relative or same‐host absolute URLs
  //      This avoids “Invalid URL” in new URL(...) if an attacker tries to
  //      supply a malicious external URL. Always return a safe URL.
  callbacks: {
    async redirect({ url, baseUrl }) {
      // If `url` is a relative path, allow it
      if (url.startsWith('/')) return url;
      // If `url` is on the same origin, allow it
      try {
        const dest = new URL(url);
        if (dest.origin === baseUrl) return url;
      } catch (e) {
        console.error('redirect callback received invalid url:', url, e);
      }
      // Otherwise, default to `baseUrl`
      return baseUrl;
    },
  },

  // 2g. Secret used to encrypt JWTs; must be set in Netlify environment
  secret: process.env.NEXTAUTH_SECRET,

  // 2h. Cookie settings: ensure path is “/” (so /api/auth/session can read it)
  cookies: {
    sessionToken: {
      name:    'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path:     '/',                        // Must be “/” so all /api/auth calls see it
        secure:   process.env.NODE_ENV === 'production',
      },
    },
  },

  // 2i. Enable debug logging in development
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

