// lib/mongodb.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

// Optional override of the DB name; otherwise uses the one in the URI
const dbName = process.env.MONGODB_DB;

// Connection options
const options = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Persist client across module reloads in development
let cached = globalThis._mongo || { client: null, clientPromise: null };
if (!globalThis._mongo) {
  globalThis._mongo = cached;
}

// Create a raw MongoClient promise for external adapters and one‐time index setup
if (!cached.clientPromise) {
  cached.clientPromise = MongoClient.connect(uri, options)
    .then(client => {
      cached.client = client;

      // Once connected, ensure indexes exist
      const database = dbName ? client.db(dbName) : client.db();
      const itemsCol = database.collection('items');

      // Create or confirm the unique + sparse SKU index
      itemsCol.createIndex(
        { sku: 1 },
        { unique: true, sparse: true, name: 'sku_1' }
      ).catch(error => {
        if (error.code !== 86) {
          // Re‐throw unexpected errors
          throw error;
        }
        // If index already exists with correct specs, ignore
      });

      // Ensure a descending index on lastUpdated
      itemsCol.createIndex(
        { lastUpdated: -1 },
        { name: 'lastUpdated_-1' }
      ).catch(err => {
        // If it already exists, no action needed
        if (err.code !== 86) {
          throw err;
        }
      });

      return client;
    });
}

const clientPromise = cached.clientPromise;

/**
 * Returns a connected { client, db } pair.
 * Automatically creates required indexes on 'items'.
 */
export async function connectToDB() {
  const client = await clientPromise;
  const databaseName = dbName || client.db().databaseName;
  const db = client.db(databaseName);

  const itemsCol = db.collection('items');

  try {
    // Ensure unique + sparse index on sku
    await itemsCol.createIndex(
      { sku: 1 },
      { unique: true, sparse: true, name: 'sku_1' }
    );
  } catch (error) {
    if (error.code !== 86) {
      throw error;
    }
    // If index already exists with correct specs, ignore
  }

  try {
    // Ensure descending index on lastUpdated
    await itemsCol.createIndex(
      { lastUpdated: -1 },
      { name: 'lastUpdated_-1' }
    );
  } catch (error) {
    if (error.code !== 86) {
      throw error;
    }
    // If index already exists, ignore
  }

  return { client, db };
}

export default clientPromise;

// Graceful shutdown in environments that support SIGTERM
if (typeof process !== 'undefined' && process.on) {
  process.on('SIGTERM', async () => {
    if (cached.client) {
      await cached.client.close();
      console.log('MongoDB connection closed');
    }
    process.exit(0);
  });
}
