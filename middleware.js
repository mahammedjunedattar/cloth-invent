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
