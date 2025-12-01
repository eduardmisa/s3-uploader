import { APIGatewayProxyEvent } from "aws-lambda";

const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN || "";
const LOCALHOST = "http://localhost:3000";

const allowedOrigins = [
  FRONTEND_DOMAIN,
  LOCALHOST
];

export function getCorsHeaders(event: APIGatewayProxyEvent): Record<string, string | boolean> {
  // Get the origin from the incoming request headers
  const requestOrigin = event.headers.Origin || event.headers.origin || "";

  const AllowOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : ""

  return {
    "Access-Control-Allow-Origin": AllowOrigin,
    "Access-Control-Allow-Credentials": true,
    "Vary": "Origin",
  };
}
