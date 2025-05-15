// rateLimitMiddleware.js

const { RateLimiterRedis, RateLimiterRes } = require('rate-limiter-flexible');
const Redis = require('ioredis');

// 1. Configure Redis client
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  enableOfflineQueue: false,
});

// 2. Create rate limiter instance
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 100,             // max 100 requests...
  duration: 15 * 60,       // …per 15 minutes
  blockDuration: 5 * 60,   // block for 5 minutes if exceeded
  keyPrefix: 'rl_global',
  execEvenly: false,
  rejectIfRedisNotReady: true,
});

module.exports = async function rateLimitMiddleware(req) {
  // Skip rate limiting in development
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  // Determine real client IP behind proxies/CDN
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  try {
    // Consume 1 point for this IP
    const res = await rateLimiter.consume(ip, 1);  // :contentReference[oaicite:0]{index=0}

    // Build rate-limit headers (all string values) :contentReference[oaicite:1]{index=1}
    const headers = new Headers({
      'X-RateLimit-Limit': rateLimiter.points.toString(),
      'X-RateLimit-Remaining': res.remainingPoints.toString(),
      'X-RateLimit-Reset': Math.ceil(res.msBeforeNext / 1000).toString(),
    });

    return { headers };
  } catch (err) {
    // If err.msBeforeNext exists, it's a rate-limit exceed (429) :contentReference[oaicite:2]{index=2}
    if (typeof err.msBeforeNext === 'number') {
      const retryAfter = Math.ceil(err.msBeforeNext / 1000);

      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: `Try again in ${retryAfter} seconds`,
        }),
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimiter.points.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': retryAfter.toString(),
          },
        }
      );  // :contentReference[oaicite:3]{index=3}
    }

    // Otherwise, some other error (e.g., Redis down) — log and fail open
    console.error('Rate limiter error:', err);  // :contentReference[oaicite:4]{index=4}
    return null;
  }
};
