// app/api/inventory/stats/route.js
import { connectToDB } from "@/app/lib/db";
import { NextResponse } from "next/server";
export async function GET(request) {
    try {
      const { searchParams } = new URL(request.url);
      const storeId = searchParams.get('storeId');
      
      const { db } = await connectToDB();
      console.log(storeId)
      
      const pipeline = [
        { $match: { storeId } },
        { $unwind: "$variants" },
        { 
          $facet: {
            sizes: [
              { 
                $group: { 
                  _id: "$variants.size", 
                  count: { $sum: "$variants.quantity" } 
                } 
              },
              { $project: { _id: 0, size: "$_id", count: 1 } }
            ],
            colors: [
              { 
                $group: { 
                  _id: "$variants.color", 
                  count: { $sum: "$variants.quantity" } 
                } 
              },
              { $project: { _id: 0, color: "$_id", count: 1 } }
            ]
          }
        }
      ];
  
      const result = await db.collection('items')
        .aggregate(pipeline)
        .next();
  
      const stats = {
        sizes: result.sizes.map(s => s.size).filter(Boolean),
        colors: result.colors.map(c => c.color).filter(Boolean),
        sizeCounts: Object.fromEntries(
          result.sizes.map(s => [s.size, s.count])
        ),
        colorCounts: Object.fromEntries(
          result.colors.map(c => [c.color, c.count])
        )
      };
  
      return NextResponse.json(stats);
  
    } catch (error) {
      console.error('Stats API Error:', error);
      return NextResponse.json(
        { error: 'Failed to load inventory stats' },
        { status: 500 }
      );
    }
  }