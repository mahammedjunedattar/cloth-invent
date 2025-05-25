import { NextResponse } from 'next/server';
import clientPromise from '@/app/lib/db';

export async function GET() {
  try {
    const client = await clientPromise;
    const ping = await client.db().admin().ping();
    return NextResponse.json({
      status: 'success',
      message: 'MongoDB connected',
      ping
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error.message },
      { status: 500 }
    );
  }
}
