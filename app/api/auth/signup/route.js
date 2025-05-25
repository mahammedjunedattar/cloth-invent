// app/api/auth/signup/route.js
import { NextResponse } from 'next/server';
import { connectToDB } from '@/app/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ObjectId } from 'mongodb';  // ← Make sure you import ObjectId

// 1) Define your Zod schema for validation
const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters.")
});

// 2) CORS headers you want on every response
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// 3) Handle preflight (OPTIONS) before anything else
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

// 4) Handle POST (this must be exactly one of these two syntaxes)
export async function POST(request) {
  try {
    // 4.a) Parse + validate incoming JSON
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors },
        { status: 400, headers: corsHeaders }
      );
    }

    // 4.b) Connect to MongoDB
    const client = await connectToDB();
    const db = client.db();

    // 4.c) Check if the user already exists (case-insensitive)
    const emailLower = parsed.data.email.toLowerCase();
    const existingUser = await db
      .collection('users')
      .findOne({ email: emailLower });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409, headers: corsHeaders }
      );
    }

    // 4.d) Hash password + create a new ObjectId for the store
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const storeId = new ObjectId().toString();

    // 4.e) Insert the new user
    const result = await db.collection('users').insertOne({
      name: parsed.data.name,
      email: emailLower,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
      storeId,
      role: 'owner'
    });

    // 4.f) Return success (201)
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

// 5) If anyone sends a GET (or any other method) to this route, explicitly return 405
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

// 6) Force dynamic so Next won’t cache at the edge
export const dynamic = 'force-dynamic';


