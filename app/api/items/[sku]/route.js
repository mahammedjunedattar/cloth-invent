"use server";

// app/api/items/[sku]/route.js
// app/api/items/[sku]/route.js
import { NextResponse } from 'next/server';
import { getToken }     from 'next-auth/jwt';
import { connectToDB }  from '@/app/lib/db';
import { validateItem } from '@/app/models/item';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { ObjectId } from 'mongodb';
import { z } from 'zod'; // Add this import at the top
import { revalidatePath } from 'next/cache'



const SECRET     = process.env.NEXTAUTH_SECRETS;
const COOKIE_DEV = 'next-auth.session-token';
const COOKIE_PROD= 'next-auth.session-token';

async function requireStoreId(req) {
  const token = await getToken({
    req,
    secret: SECRET,
    cookieName: process.env.NODE_ENV === 'production'
      ? COOKIE_PROD
      : COOKIE_DEV
  });
  console.log(token)
  return token?.storeId ?? null;
}
export async function GET(request, { params }) {
  const storeId = await requireStoreId(request);
  if (!storeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { db } = await connectToDB();
  const item = await db
    .collection('items')
    .findOne({ sku: params.sku, storeId }, { projection: { _id: 0, storeId: 0 } });
  return item
    ? NextResponse.json(item)
    : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(request, { params }) {

  const storeId = await requireStoreId(request);
  console.log(storeId)

  if (!storeId) {
    return NextResponse.json({ error: 'Unauthorizeddddddddddd' }, { status: 401 });
  }

  try {
    const { db } = await connectToDB();
    const { sku } = await params;
    console.log( typeof sku)

   const result = await db.collection('items').updateOne(
      { storeId, 'variants.sku': sku },
      { $pull: { variants: { sku } } }
    );
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE Error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDB();
    const { sku: variantSku } = await params;
    const body = await request.json();

    // Find parent item containing this variant
    const parentItem = await db.collection('items').findOne({
      storeId: session.user.storeId,
      'variants.sku': variantSku
    });

    if (!parentItem) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }

    // Validate only the variant data
    const variantSchema = z.object({
      size: z.string().min(1),
      color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
      price: z.number().positive(),
      quantity: z.number().int().nonnegative(),
      barcode: z.string().regex(/^[0-9]{12,14}$/)
    });

    const validation = variantSchema.safeParse(body);
    console.log(validation)
    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.errors },
        { status: 400 }
      );
    }

    // Update only the specific variant
    const result = await db.collection('items').findOneAndUpdate(
      { 
        _id: parentItem._id,
        'variants.sku': variantSku 
      },
      { $set: { 
        'variants.$': { 
          ...body,
          sku: variantSku // Maintain original SKU
        } 
      }},
      { returnDocument: 'after' }
    );
console.log(result.value)
revalidatePath('/dashboard');            // Overview dashboard
return NextResponse.json(result.value);

  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update variant' }, 
      { status: 500 }
    );
  }
}