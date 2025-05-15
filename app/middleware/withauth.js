// middleware/auth.js
import { NextResponse } from 'next/server';
import { getToken }     from 'next-auth/jwt';

export async function withStoreAuth(request) {
  try {
    const token = await getToken({
      req:   request,
      secret: process.env.NEXTAUTH_SECRETS,
      secureCookie: process.env.NODE_ENV === 'production'
    });
    // token will be null if cookie missing or invalid
    if (!token?.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const headers = new Headers(request.headers);
    headers.set('x-store-id', token.storeId);
    return NextResponse.next({ request: { headers } });
  } catch (err) {
    console.error('Middleware error:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export const config = { matcher: ['/api/items/:path*'] };
