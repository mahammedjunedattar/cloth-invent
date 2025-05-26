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

// 2) Main POST handler (no in-code CORS or OPTIONS)
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON" },
      { status: 400 }
    );
  }

  // 2.a) Validate with Zod
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // 2.b) Connect to DB and run your signup logic
  try {
    const { db } = await connectToDB();
    const emailLower = parsed.data.email.toLowerCase();

    // Check for existing user
    const existingUser = await db
      .collection('users')
      .findOne({ email: emailLower });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    // Hash password + generate storeId
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const storeId = new ObjectId().toString();

    // Insert new user
    const result = await db.collection('users').insertOne({
      name: parsed.data.name,
      email: emailLower,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
      storeId,
      role: "owner"
    });

    return NextResponse.json(
      { success: true, userId: result.insertedId, storeId },
      { status: 201 }
    );
  } catch (err) {
    console.error("Signup DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 3) Reject any other HTTP method with 405
export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed. Use POST." },
    { status: 405 }
  );
}
export async function PUT() {
  return NextResponse.json(
    { error: "Method Not Allowed. Use POST." },
    { status: 405 }
  );
}
export async function DELETE() {
  return NextResponse.json(
    { error: "Method Not Allowed. Use POST." },
    { status: 405 }
  );
}

// 4) Prevent caching at the edge (optional for Vercel)
export const dynamic = "force-dynamic";




