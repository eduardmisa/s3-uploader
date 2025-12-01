import * as jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { APIGatewayProxyHandler } from "aws-lambda";
import { getCorsHeaders } from "./http-utils";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Wrap sign/verify calls with any-casts to avoid strict typing differences
 * between jsonwebtoken's runtime usage and the TypeScript typings.
 */
export const signJwt = (payload: Record<string, any>) => {
  return (jwt as any).sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any);
};

export const verifyJwt = (token: string) => {
  if (!token) throw new Error("No token provided");
  return (jwt as any).verify(token, JWT_SECRET);
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Higher-order wrapper to enforce JWT authentication for API Gateway handlers.
 * Usage:
 *   export const myHandler: APIGatewayProxyHandler = withAuth(async (event) => { ... });
 *
 * On missing/invalid token this will return a 401 response with CORS headers.
 */
export const withAuth = (handler: APIGatewayProxyHandler): APIGatewayProxyHandler => {
  return async (event, context, callback): Promise<any> => {
    const corsHeaders = getCorsHeaders(event);

    try {
      const authHeader = (event.headers && (event.headers.Authorization || event.headers.authorization)) as string | undefined;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          statusCode: 401,
          body: JSON.stringify({ message: "Unauthorized" }),
          headers: corsHeaders,
        } as any;
      }

      const token = authHeader.split(" ")[1];
      try {
        verifyJwt(token);
      } catch (err) {
        return {
          statusCode: 401,
          body: JSON.stringify({ message: "Invalid token" }),
          headers: corsHeaders,
        } as any;
      }

      // Passed auth — delegate to original handler. Cast to any to satisfy handler return types.
      return await (handler(event, context, callback) as Promise<any>);
    } catch (err) {
      // Unexpected error during auth
      console.error("Auth wrapper error:", err);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Authentication error" }),
        headers: corsHeaders,
      } as any;
    }
  };
};
