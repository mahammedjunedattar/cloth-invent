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
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// NextAuth options
export const authOptions = {
  // MongoDBAdapter configuration
  adapter: MongoDBAdapter(clientPromise, {
    databaseName: process.env.MONGODB_DB || 'yourdb',
    collections: {
      Users: 'users',
      Sessions: 'sessions',
      Accounts: 'accounts',
      VerificationTokens: 'verification_tokens',
    },
  }),

  // Providers configuration
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
      name: 'Email / Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          // Validate credentials
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;

          // Fetch user from database
          const client = await clientPromise;
          const db = client.db();
          
          const user = await db.collection('users').findOne({
            email: parsed.data.email.toLowerCase(),
          });

          // Validate user and password
          if (!user?.password) return null;
          const isValid = await bcrypt.compare(parsed.data.password, user.password);
          if (!isValid) return null;

          // Return user data for JWT
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

  // Session configuration
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,   // 1 day
    updateAge: 6 * 60 * 60, // 6 hours
  },

  // Callbacks configuration
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.storeId = user.storeId;
        token.role = user.role;
      }
      return token;
    },
    
    async session({ session, token }) {
      console.log(token)
      session.user = {
        ...session.user,
        id: token.id,
        storeId: token.storeId,
        role: token.role
      };
      return session;
    },
    
    async redirect({ url, baseUrl }) {
      // Allow relative URLs
      if (url.startsWith('/')) return url;
      
      // Validate same-origin URLs
      try {
        const dest = new URL(url);
        if (dest.origin === baseUrl) return url;
      } catch (e) {
        console.error('Invalid redirect URL:', url, e);
      }
      
      // Fallback to base URL
      return baseUrl;
    },
  },

  // Pages configuration
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },

  // Cookies configuration
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production'
          ? process.env.COOKIE_DOMAIN || '.yourdomain.com'
          : undefined
      }
    }
  },

  // Security settings
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
