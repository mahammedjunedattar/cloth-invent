// app/auth/[...nextauth]/route.js
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import clientPromise from '@/app/lib/db';

// Zod schema for credentials validation
const credentialsSchema = z.object({
  email:    z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const authOptions = {
  // 1) MongoDB Adapter
  adapter: MongoDBAdapter(clientPromise, {
    databaseName: process.env.MONGODB_DB || 'yourdb',
    collections: {
      Users:             'users',
      Sessions:          'sessions',
      Accounts:          'accounts',
      VerificationTokens:'verification_tokens',
    },
  }),

  // 2) Auth Providers
  providers: [
    // 2.a) Google Oauth
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt:        'consent',
          access_type:   'offline',
          response_type: 'code',
        },
      },
    }),

    // 2.b) Credentials
    CredentialsProvider({
      id:   'credentials',
      name: 'Email / Password',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          // Validate input
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;

          // Connect to DB
          const client = await clientPromise;
          const db     = client.db();
          
          // Find user
          const user = await db.collection('users').findOne({
            email: parsed.data.email.toLowerCase(),
          });

          // No user or no password field
          if (!user?.password) return null;

          // Compare passwords
          const isValid = await bcrypt.compare(parsed.data.password, user.password);
          if (!isValid) return null;

          // Return “user” object: this becomes `token` in jwt callback
          return {
            id:      user._id.toString(),
            email:   user.email,
            name:    user.name || 'User',
            storeId: user.storeId,
            role:    user.role || 'user',
          };
        } catch (error) {
          console.error('Credentials authorize() error:', error);
          return null;
        }
      },
    }),
  ],

  // 3) Session via JWT
  session: {
    strategy: 'jwt',
    maxAge:   24 * 60 * 60,  // 1 day
    updateAge: 6 * 60 * 60,  // 6 hours
  },

  // 4) Callbacks
  callbacks: {
    // 4.a) Attach custom fields into token
    async jwt({ token, user }) {
      if (user) {
        token.id      = user.id;
        token.storeId = user.storeId;
        token.role    = user.role;
      }
      return token;
    },
    // 4.b) Expose those fields on `session.user`
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id:      token.id,
        storeId: token.storeId,
        role:    token.role,
      };
      return session;
    },
    // 4.c) Safe redirect
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return url;
      try {
        const dest = new URL(url);
        if (dest.origin === baseUrl) return url;
      } catch (e) {
        console.error('Invalid redirect URL:', url, e);
      }
      return baseUrl;
    },
  },

  // 5) Custom pages
  pages: {
    signIn: '/login',
    error:  '/auth/error',
  },

  // 6) Use default cookie settings (no custom domain)
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? 'next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path:     '/',
        secure:   process.env.NODE_ENV === 'production',
      },
    },
  },

  // 7) Required for JWT encryption & callbacks
  secret: process.env.NEXTAUTH_SECRET,

  // 8) Logging
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

