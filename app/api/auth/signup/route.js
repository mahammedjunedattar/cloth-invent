// app/api/auth/signup/route.js
import { NextResponse } from 'next/server';
import { connectToDB } from '@/app/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,           // changed from 204 to 200
    headers: corsHeaders,
  });
}

export async function POST(request) {
  // Always attach CORS headers before anything else
  const headers = corsHeaders;

  try {
    // 1) Connect to the database
    const client = await connectToDB();
    const db = client.db();

    // 2) Parse + validate body
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      // If validation fails, return 400 + CORS
      return NextResponse.json(
        { error: parsed.error.errors },
        { status: 400, headers }
      );
    }

    // 3) Check if user already exists
    const existingUser = await db
      .collection('users')
      .findOne({ email: parsed.data.email.toLowerCase() });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409, headers }
      );
    }

    // 4) Hash password + insert new user
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    await db.collection('users').insertOne({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 5) Return success
    return NextResponse.json(
      { success: true },
      { status: 201, headers }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}

