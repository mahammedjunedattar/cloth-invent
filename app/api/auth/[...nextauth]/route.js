import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import clientPromise from '@/app/lib/db'; // Adjust path if needed

// Zod schema for credentials validation
const credentialsSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise, {
    databaseName: 'yourdb',
    collections: {
      Users: 'users',
      Sessions: 'sessions',
      Accounts: 'accounts',
      VerificationTokens: 'verification_tokens',
    },
  }),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const client = await clientPromise;
          const db = client.db(); // Ensure this matches your DB name

          const user = await db
            .collection('users')
            .findOne({ email: parsed.data.email.toLowerCase() });

          if (!user?.password) return null;

          const isValid = await bcrypt.compare(parsed.data.password, user.password);
          if (!isValid) return null;

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name || 'User',
            storeId: user.storeId,
            role: user.role || 'user',
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,        // 1 day
    updateAge: 6 * 60 * 60,      // 6 hours
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.storeId = user.storeId;
        token.role = user.role;
      }
      if (trigger === 'update' && session?.storeId) {
        token.storeId = session.storeId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.storeId = token.storeId;
      session.user.role = token.role;
      session.user.id = token.sub;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/auth/error',
  },

  secret: process.env.NEXTAUTH_SECRET,

  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
