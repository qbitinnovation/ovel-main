import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable in .env.local');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  retryAfter: number;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null, retryAfter: 0 };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (cached.retryAfter > Date.now()) {
    throw new Error('MongoDB connection is temporarily unavailable');
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
      console.log('✅ MongoDB connected');
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
    cached.retryAfter = 0;
  } catch (e) {
    cached.promise = null;
    cached.retryAfter = Date.now() + 30_000;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
