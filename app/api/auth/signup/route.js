// app/api/auth/signup/route.js
import { NextResponse } from 'next/server';
import { connectToDB } from '@/app/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ObjectId } from 'mongodb';

// 1) Zod schema for incoming data
const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters.")
});

// 2) CORS headers for every response
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// 3) Preflight handler (OPTIONS)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

// 4) Main POST handler
export async function POST(request) {
  try {
    // 4.a) Parse & validate request body
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors },
        { status: 400, headers: corsHeaders }
      );
    }

    // 4.b) Connect to MongoDB (destructure { db } directly)
    const { db } = await connectToDB();
    // — remove any `client.db()` call; we already have `db`.

    // 4.c) Check for existing user (case‐insensitive email)
    const emailLower = parsed.data.email.toLowerCase();
    const existingUser = await db.collection('users').findOne({ email: emailLower });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409, headers: corsHeaders }
      );
    }

    // 4.d) Hash password & generate a new storeId
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const storeId = new ObjectId().toString();

    // 4.e) Insert the new user document
    const result = await db.collection('users').insertOne({
      name: parsed.data.name,
      email: emailLower,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
      storeId,
      role: 'owner'
    });

    // 4.f) Return success with userId & storeId
    return NextResponse.json(
      { success: true, userId: result.insertedId, storeId },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// 5) Reject any unsupported methods with 405 + CORS
export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST.' },
    { status: 405, headers: corsHeaders }
  );
}
export async function PUT() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST.' },
    { status: 405, headers: corsHeaders }
  );
}
export async function DELETE() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST.' },
    { status: 405, headers: corsHeaders }
  );
}

// 6) Force dynamic so Next won’t cache at the edge (optional for Vercel)
export const dynamic = 'force-dynamic';



