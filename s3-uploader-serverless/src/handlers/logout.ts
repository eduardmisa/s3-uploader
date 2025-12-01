import { APIGatewayProxyHandler } from "aws-lambda";
import { getCorsHeaders } from "../lib/http-utils";

/**
 * Logout handler:
 * - Returns multiValueHeaders with Set-Cookie entries that clear CloudFront cookies (and any other cookies) by setting Max-Age=0.
 * - Keeps CORS headers to allow browser to accept the response.
 */
export const logout: APIGatewayProxyHandler = async (event) => {
  try {
    const cookieOptions = `Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;

    const multiValueHeaders: Record<string, string[]> = {
      "Set-Cookie": [
        `CloudFront-Policy=; ${cookieOptions}`,
        `CloudFront-Signature=; ${cookieOptions}`,
        `CloudFront-Key-Pair-Id=; ${cookieOptions}`,
      ],
    };

    const headers = getCorsHeaders(event);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Logged out" }),
      headers,
      multiValueHeaders,
    };
    } catch (err) {
    console.error("Logout error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Logout failed" }),
      headers: getCorsHeaders(event),
    };
  }
};
