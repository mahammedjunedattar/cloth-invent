// app/api/auth/[...nextauth]/route.js
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import clientPromise from '@/app/lib/db';

const credentialsSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRETS,
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          storeId: null, // Initialize storeId for Google users
          role: 'user'
        };
      }
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
          const db = client.db();
          
          const user = await db.collection('users').findOne({ 
            email: parsed.data.email.toLowerCase() 
          });

          if (!user?.password) return null;
          
          const isValid = await bcrypt.compare(parsed.data.password, user.password);
          if (!isValid) return null;

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name || 'User',
            storeId: user.storeId?.toString(), // Ensure string conversion
            role: user.role || 'user'
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id; // Required for session management
        token.storeId = user.storeId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub; // Include user ID in session
      session.user.storeId = token.storeId;
      session.user.role = token.role;
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
    newUser: '/setup-store' // Add store setup flow
  },
  secret: process.env.NEXTAUTH_SECRETS, // Corrected environment variable name
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? '.https://stock-invent-mahammedjunedattars-projects.vercel.app' : undefined
      }
    }
  },
  debug: process.env.NODE_ENV === 'development',
  useSecureCookies: process.env.NODE_ENV === 'production'
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };