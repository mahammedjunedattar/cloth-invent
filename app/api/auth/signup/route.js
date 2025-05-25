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

// Handle OPTIONS requests first
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async const POST = (request) => {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors },
        { status: 400, headers: corsHeaders }
      );
    }

    const client = await connectToDB();
    const db = client.db();
    
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
    
    const result = await db.collection('users').insertOne({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
      storeId: new ObjectId().toString(),
      role: 'owner'
    });

    return NextResponse.json(
      { success: true, userId: result.insertedId },
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

