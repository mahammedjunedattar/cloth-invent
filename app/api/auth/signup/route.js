// app/api/auth/signup/route.js
import { NextResponse } from 'next/server';
import { connectToDB } from '@/app/lib/db'; // adjust if this returns a MongoClient instead
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

// Centralize your CORS headers so they’re identical everywhere
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // If you ever send cookies or Authorization headers, add:
  // 'Access-Control-Allow-Credentials': 'true',
  // 'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 1) Respond to OPTIONS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Vercel-CDN-Cache-Control': 'no-auth', // ensure Vercel won’t cache this
    },
  });
}

// 2) If someone tries GET (or any method besides POST/OPTIONS), return 405 + CORS
export async function GET() {
  return NextResponse.json(
    { error: 'Method GET not allowed. Use POST.' },
    {
      status: 405,
      headers: corsHeaders,
    }
  );
}

// 3) Main POST handler (signup flow)
export async function POST(request) {
  try {
    // a) Parse + validate request body
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // b) Connect to database
    // — if connectToDB() returns { db }, use that. If it returns MongoClient, swap back accordingly.
    const { db } = await connectToDB();
    // If yours is: `const client = await connectToDB(); const db = client.db();`
    // then do that instead.

    // c) Check for existing user (case‐insensitive email)
    const emailLower = parsed.data.email.toLowerCase();
    const existingUser = await db.collection('users').findOne({ email: emailLower });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        {
          status: 409,
          headers: corsHeaders,
        }
      );
    }

    // d) Hash password + assign a new storeId
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const storeId = new ObjectId();

    // e) Insert new user
    await db.collection('users').insertOne({
      name: parsed.data.name,
      email: emailLower,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
      storeId,
      role: 'owner',
    });

    // f) Return success + storeId
    return NextResponse.json(
      { message: 'User created', storeId },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

// 4) If any other HTTP method (PUT, DELETE, etc.) hits this route, return 405 + CORS
export const dynamic = 'force-dynamic'; // ensure this API route doesn’t get cached at edge
export function GET() {} // already defined above
export function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405, headers: corsHeaders }
  );
}
export function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405, headers: corsHeaders }
  );
}

