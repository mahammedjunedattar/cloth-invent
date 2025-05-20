// lib/mongodb.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

// Allow overriding the DB name, default to the one in the URI
const dbName = process.env.MONGODB_DB;

// Connection options
const options = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Use globalThis to persist across module reloads
let cached = globalThis._mongo || { client: null, clientPromise: null, db: null };
if (!globalThis._mongo) {
  globalThis._mongo = cached;
}

// Raw MongoClient promise for external adapters
if (!cached.clientPromise) {
  cached.clientPromise = MongoClient.connect(uri, options)
    .then(client => {
      cached.client = client;
      // Once connected, create indexes
      const database = dbName ? client.db(dbName) : client.db();
      database.collection('items').createIndexes([
        { key: { sku: 1 }, unique: true },
        { key: { lastUpdated: -1 } },
      ]);
      return client;
    });
}

/**
 * A promise that resolves to a connected MongoClient.
 * Useful for libraries that need access to the client itself.
 */
 const clientPromise = cached.clientPromise;
 export default clientPromise

/**
 * Returns a connected { client, db } pair, caching both.
 * @returns {Promise<{ client: MongoClient, db: import('mongodb').Db }>}
 */
let cachedClient = null;
let cachedDb = null;

export async function connectToDB() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// Optional: Graceful shutdown in server environments
if (typeof process !== 'undefined' && process.on) {
  process.on('SIGTERM', async () => {
    if (cached.client) {
      await cached.client.close();
      console.log('MongoDB connection closed');
    }
    process.exit(0);
  });
}
