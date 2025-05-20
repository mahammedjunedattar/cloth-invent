// app/api/auth/signup/route.js
import { NextResponse } from 'next/server';
import { connectToDB } from '@/app/lib/db';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

export async function POST(request) {
  // Verify MongoDB connection first
  let db;
  try {
    const client = await connectToDB();
    db = client.db();
  } catch (dbError) {
    console.error('Database connection error:', dbError);
    return NextResponse.json(
      { error: 'Database connection failed' },
      { status: 500, headers: corsHeaders }
    );
  }

  // Handle request
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400, headers: corsHeaders }
      );
    }

    const existingUser = await db.collection('users').findOne({ 
      email: parsed.data.email.toLowerCase() 
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409, headers: corsHeaders }
      );
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const storeId = new ObjectId();

    const result = await db.collection('users').insertOne({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
      storeId,
      role: 'owner'
    });

    if (!result.acknowledged) {
      throw new Error('User creation failed');
    }

    return NextResponse.json(
      { 
        message: 'User created', 
        userId: result.insertedId,
        storeId
      },
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Internal server error'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Centralized CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};
