// middleware.js
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

// Protected routes configuration
const protectedRoutes = [
  '/Dashboard',
  '/api/items',
  '/api/stores',
  '/inventory'
];

const authRoutes = [
  '/login',
  '/signup'
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request });
  
  // Check if route requires authentication
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );

  // Check if route is auth-related
  const isAuthRoute = authRoutes.includes(pathname);

  // Handle API routes
  if (pathname.startsWith('/api')) {
    if (!token?.storeId) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing store context' },
        { status: 401 }
      );
    }

    // Clone headers to add store context
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-store-id', token.sub);

    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  }

  // Redirect logged-in users from auth routes
  if (isAuthRoute && token?.sub) {
    return NextResponse.redirect(new URL('/Dashboard', request.url));
  }

  // Protect routes for unauthenticated users
  if (isProtectedRoute && !token?.sub) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};