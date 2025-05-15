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

export async function POST(request) {
    const response = NextResponse.json({ message: 'User created' }, { status: 201 });
  
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', process.env.NEXTAUTH_URL);
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const body = await request.json();
    console.log(body)
    const parsed = signupSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { db } = await connectToDB();
    const existingUser = await db.collection('users').findOne({ email: parsed.data.email });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    
    await db.collection('users').insertOne({
      ...parsed.data,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
      storeId: new ObjectId(), // Your store creation logic here

    });

    response.headers.set('Access-Control-Allow-Origin', process.env.NEXTAUTH_URL);
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return response;
        

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}