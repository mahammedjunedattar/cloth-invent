"use server";

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { connectToDB } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const SECRET = process.env.NEXTAUTH_SECRET;
const COOKIE_NAME = process.env.NODE_ENV === 'production' 
  ? '__Secure-next-auth.session-token' 
  : 'next-auth.session-token';

// 1. Centralized Auth Functions
async function getStoreId(req) {
  const token = await getToken({ req, secret: SECRET, cookieName: COOKIE_NAME });
  return token?.storeId;
}

async function validateSession() {
  const session = await getServerSession(authOptions);
  return session?.user?.storeId;
}

// 2. Shared Variant Schema
const variantSchema = z.object({
  size: z.string().min(1, "Size required"),
  color: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, "Invalid hex color"),
  price: z.number().positive("Price must be positive"),
  quantity: z.number().int().nonnegative("Invalid quantity"),
  barcode: z.string().regex(/^\d{12,14}$/, "Invalid barcode format")
});

// 3. GET Handler
export async function GET(request, { params }) {
  try {
    const storeId = await getStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { db } = await connectToDB();
    const item = await db.collection('items').findOne(
      { 
        storeId,
        $or: [
          { sku: params.sku },
          { "variants.sku": params.sku }
        ]
      },
      { projection: { _id: 0, storeId: 0 } }
    );

    return item 
      ? NextResponse.json(item) 
      : NextResponse.json({ error: 'Item not found' }, { status: 404 });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// 4. DELETE Handler
export async function DELETE(request, { params }) {
  try {
    const storeId = await validateSession();
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { db } = await connectToDB();
    const { sku } = params;

    const result = await db.collection('items').updateOne(
      { 
        storeId,
        "variants.sku": sku 
      },
      { $pull: { variants: { sku } } }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }

    revalidatePath('/dashboard/items');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// 5. PUT Handler
export async function PUT(request, { params }) {
  try {
    const storeId = await validateSession();
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { db } = await connectToDB();
    const { sku: variantSku } = params;
    const body = await request.json();

    // Validate request body
    const validation = variantSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.format() },
        { status: 400 }
      );
    }

    // Atomic update operation
    const result = await db.collection('items').findOneAndUpdate(
      { 
        storeId,
        "variants.sku": variantSku 
      },
      { $set: { "variants.$[elem]": { ...validation.data, sku: variantSku } } },
      { 
        arrayFilters: [{ "elem.sku": variantSku }],
        returnDocument: 'after' 
      }
    );

    if (!result.value) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }

    revalidatePath('/dashboard/items');
    return NextResponse.json(result.value);
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// 6. Fix for Duplicate Key Error
/*
1. Check for null/missing sku values in items collection:
db.items.find({ sku: { $in: [null, ""] } })

2. Either:
   - Add unique SKUs to affected documents
   - Create sparse index (if SKU is optional):
db.items.createIndex({ sku: 1 }, { unique: true, sparse: true });
*/
