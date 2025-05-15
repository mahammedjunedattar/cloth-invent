import { RateLimiterMemory } from 'rate-limiter-flexible';


const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
  blockDuration: 60 * 15
});

export default async function rateLimitMiddleware(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
            req.headers.get('x-real-ip') || 
            '127.0.0.1';

  try {
    await rateLimiter.consume(ip);
    return null;
  } catch (rejRes) {
    return new Response(JSON.stringify({
      error: 'Too many requests - try again later'
    }), {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(rejRes.msBeforeNext / 1000)),
        'Content-Type': 'application/json',
      }
    });
  }
}
