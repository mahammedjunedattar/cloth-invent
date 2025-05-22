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

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

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
