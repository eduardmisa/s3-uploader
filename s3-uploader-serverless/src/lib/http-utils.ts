const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN || ""

export function getCorsHeaders(): Record<string, string | boolean> {
  return {
    "Access-Control-Allow-Origin": FRONTEND_DOMAIN,
    "Access-Control-Allow-Credentials": true,
    "Vary": "Origin",
  };
}
