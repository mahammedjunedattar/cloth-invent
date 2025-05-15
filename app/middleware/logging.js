// middleware/logging.js
export async function middleware(req) {
    console.log({
      user: req.user?.email,
      path: req.nextUrl.pathname,
      timestamp: new Date().toISOString()
    });
  }