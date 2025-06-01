// app/api/items/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connectToDB } from '@/app/lib/db';
import rateLimitMiddleware from '@/app/lib/rateLimiter';
import { validateItem } from '@/app/models/item';
import { authOptions } from '../auth/[...nextauth]/route';

// Sanitize input and prevent regex injection
const sanitizeRegex = (str) => {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Corrected session retrieval function
async function getValidatedSession() {
  try {
    const session = await getServerSession(authOptions);
    console.log(session)
    if (!session?.user?.storeId) {
      return { error: 'Unauthorized access', status: 401 };
    }
    return { session };
  } catch (error) {
    console.error('Session retrieval error:', error);
    return { error: 'Authentication failed', status: 500 };
  }
}

export async function GET(request) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request);
    if (rateLimitResponse) {
      if (rateLimitResponse instanceof Response) return rateLimitResponse;
      return NextResponse.json({}, { headers: rateLimitResponse.headers });
    }

    // Session validation
    const sessionResult = await getValidatedSession();
    if (sessionResult.error) {
      return NextResponse.json(
        { error: sessionResult.error },
        { status: sessionResult.status }
      );
    }
    const { session } = sessionResult;

    // Database connection
    const { db } = await connectToDB();
    const { searchParams } = new URL(request.url);

    // Pagination and filtering
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const skip = (page - 1) * limit;

    const searchTerm = searchParams.get('search');
    const category = searchParams.get('category');
    const size = searchParams.get('size');
    const color = searchParams.get('color');
    const gender = searchParams.get('gender');

    const query = {
      storeId: session.user.storeId,
      deletedAt: null
    };

    if (searchTerm) {
      const sanitizedSearch = sanitizeRegex(searchTerm);
      query.$or = [
        { name: { $regex: sanitizedSearch, $options: 'i' } },
        { description: { $regex: sanitizedSearch, $options: 'i' } },
        { 'variants.sku': { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }
    if (category) query.category = category;
    if (gender) query.gender = gender;
    if (size) query['variants.size'] = size;
    if (color) query['variants.color'] = color;

    const [items, total] = await Promise.all([
      db.collection('items')
        .find(query)
        .project({ _id: 0, storeId: 0 })
        .sort({ lastUpdated: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('items').countDocuments(query)
    ]);

    const pagination = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total
    };

    return NextResponse.json({
      data: items,
      pagination,
      links: {
        next: pagination.hasNext
          ? `${request.nextUrl.origin}/api/items?page=${page + 1}&limit=${limit}`
          : null,
        prev: page > 1
          ? `${request.nextUrl.origin}/api/items?page=${page - 1}&limit=${limit}`
          : null
      }
    });

  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve items' }, 
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // Session validation
    const sessionResult = await getValidatedSession();
    if (sessionResult.error) {
      return NextResponse.json(
        { error: sessionResult.error },
        { status: sessionResult.status }
      );
    }
    const { session } = sessionResult;

    // Database connection
    const { db } = await connectToDB();
    const body = await request.json();

    // Validate item data
    const validation = validateItem({
      ...body,
      storeId: session.user.storeId,
      createdBy: session.user.role
    });

    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.errors },
        { status: 400 }
      );
    }

    // Check for existing SKUs
    const skusToCheck = validation.data.variants.map(v => v.sku).filter(Boolean);
    if (skusToCheck.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid SKU required' },
        { status: 400 }
      );
    }

    const existingSKUs = await db.collection('items').find({
      storeId: session.user.storeId,
      "variants.sku": { $in: skusToCheck }
    }).project({ "variants.sku": 1 }).toArray();

    if (existingSKUs.length > 0) {
      const duplicates = [...new Set(
        existingSKUs.flatMap(item => 
          item.variants.map(v => v.sku).filter(sku => skusToCheck.includes(sku))
        )
      )];
      return NextResponse.json(
        { error: 'Duplicate SKUs found: ' + duplicates.join(', ') },
        { status: 409 }
      );
    }

    // Insert item
    const result = await db.collection('items').insertOne({
      ...validation.data,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    // Retrieve created item
    const createdItem = await db.collection('items').findOne(
      { _id: result.insertedId },
      { projection: { _id: 0, storeId: 0 } }
    );

    // Audit log
    await db.collection('audit_logs').insertOne({
      action: 'ITEM_CREATE',
      userId: session.user.id,
      storeId: session.user.storeId,
      targetId: result.insertedId,
      details: validation.data,
      timestamp: new Date()
    });

    return NextResponse.json(createdItem, { status: 201 });

  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create item' }, 
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    // Session validation
    const sessionResult = await getValidatedSession();
    if (sessionResult.error) {
      return NextResponse.json(
        { error: sessionResult.error },
        { status: sessionResult.status }
      );
    }
    const { session } = sessionResult;

    // Database connection
    const { db } = await connectToDB();
    const { sku, quantity, operation } = await request.json();

    // Validate operation
    if (!['increment', 'decrement'].includes(operation)) {
      return NextResponse.json(
        { error: 'Invalid operation' }, 
        { status: 400 }
      );
    }

    // Prepare update operation
    const update = operation === 'increment'
      ? { $inc: { 'variants.$[elem].quantity': quantity } }
      : { $inc: { 'variants.$[elem].quantity': -quantity } };

    // Execute update
    const result = await db.collection('items').updateOne(
      {
        storeId: session.user.storeId,
        'variants.sku': sku
      },
      update,
      {
        arrayFilters: [{ 'elem.sku': sku }],
        returnDocument: 'after'
      }
    );

    if (!result.modifiedCount) {
      return NextResponse.json(
        { error: 'Variant not found' }, 
        { status: 404 }
      );
    }

    // Audit log
    await db.collection('audit_logs').insertOne({
      action: 'STOCK_UPDATE',
      userId: session.user.id,
      storeId: session.user.storeId,
      targetSKU: sku,
      details: { quantity, operation },
      timestamp: new Date()
    });

    return NextResponse.json({
      message: 'Stock updated successfully',
      newQuantity: result.value.variants.find(v => v.sku === sku).quantity
    });

  } catch (error) {
    console.error('PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to update stock' }, 
      { status: 500 }
    );
  }
}
