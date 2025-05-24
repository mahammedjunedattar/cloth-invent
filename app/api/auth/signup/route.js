// app/api/auth/signup/route.js
import { NextResponse } from 'next/server';
import { connectToDB } from '@/app/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// middleware.js
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { default as NextAuthMiddleware } from 'next-auth/middleware';

// Configure allowed origins (modify for production)
const allowedOrigins = [
  process.env.NEXTAUTH_URL,
  'http://localhost:3000'
];

// Security headers configuration
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export async function middleware(request) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...securityHeaders,
        'Access-Control-Allow-Origin': allowedOrigins.join(', '),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  // Apply security headers to all responses
  const response = NextResponse.next();
  
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Handle NextAuth authentication for protected routes
  const authMiddleware = await NextAuthMiddleware(request);
  
  // Bypass authentication for public routes
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = [
    '/api',
    '/login',
    '/signup',
    '/_next',
    '/favicon.ico'
  ].some(path => pathname.startsWith(path));

  return isPublicRoute ? response : authMiddleware;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|login|signup).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
};
export async function POST(request) {
  try {
    const client = await connectToDB();
    const db = client.db();
    
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors },
        { status: 400, headers: corsHeaders }
      );
    }

    const existingUser = await db.collection('users').findOne({
      email: parsed.data.email.toLowerCase()
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409, headers: corsHeaders }
      );
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    
    await db.collection('users').insertOne({
      ...parsed.data,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json(
      { success: true },
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
