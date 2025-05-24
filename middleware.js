// middleware.js
import { NextResponse } from 'next/server';

export async function middleware(request) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vercel-CDN-Cache-Control': 'no-auth'
      }
    });
  }

  const response = NextResponse.next();
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|login|signup).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' }
      ]
    }
  ]
};
