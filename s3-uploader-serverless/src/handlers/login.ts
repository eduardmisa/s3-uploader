import { APIGatewayProxyHandler } from "aws-lambda";
import { getUserByEmail } from "../lib/users";
import { comparePassword, signJwt } from "../lib/auth";
import { getSignedCookies } from "../lib/cloudfront";
import { getCorsHeaders } from "../lib/http-utils";

const SESSION_VALIDITY = 24 * 60 * 60; // 1 Day

export const login: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const email = body.email && String(body.email).toLowerCase();
    const password = body.password && String(body.password);

    console.log("Payload", { email, password });

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing email or password" }),
        headers: getCorsHeaders(event),
      };
    }

    const user = getUserByEmail(email);
    if (!user) {
      console.log("Invalid Email");
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Invalid credentials" }),
        headers: getCorsHeaders(event),
      };
    }

    console.log("Target User", user);

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      console.log("Invalid Password");
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Invalid credentials" }),
        headers: getCorsHeaders(event),
      };
    }

    const token = signJwt({ email: user.email, name: user.name });

    // If CloudFront private key and key pair id are configured, create signed cookies
    const cfPrivateKey = process.env.CLOUDFRONT_PRIVATE_KEY
    const cfKeyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID || process.env.CLOUDFRONT_PUBLIC_KEY_ID;
    const cfDomain = process.env.CLOUDFRONT_DOMAIN;

    console.debug("cfPrivateKey", cfPrivateKey);
    console.debug("cfKeyPairId", cfKeyPairId);
    console.debug("cfDomain", cfDomain);

    // Basic simple headers for CORS (keeps compatibility with clients)
    const simpleHeaders: Record<string, string | boolean> = getCorsHeaders(event);

    // multiValueHeaders allows returning multiple Set-Cookie headers via API Gateway / Lambda proxy
    const multiValueHeaders: Record<string, string[]> = {};

    if (cfPrivateKey && cfKeyPairId && cfDomain) {
      try {
        const resource = `https://${cfDomain}/*`;
        const cookies = getSignedCookies(resource, SESSION_VALIDITY, cfKeyPairId, cfPrivateKey);

        // Create cookie strings. Use Secure;HttpOnly;SameSite as appropriate.
        const cookieOptions = `Path=/; Domain=.file-manager.emisa.me; Secure; HttpOnly; SameSite=Lax; Max-Age=${SESSION_VALIDITY}`;

        const cookie1 = `CloudFront-Policy=${cookies.policy}; ${cookieOptions}`;
        const cookie2 = `CloudFront-Signature=${cookies.signature}; ${cookieOptions}`;
        const cookie3 = `CloudFront-Key-Pair-Id=${cookies.keyPairId}; ${cookieOptions}`;

        multiValueHeaders["Set-Cookie"] = [cookie1, cookie2, cookie3];
      } catch (err) {
        console.error("Failed to generate CloudFront signed cookies:", err);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        token,
        user: { email: user.email, name: user.name },
      }),
      headers: simpleHeaders,
      multiValueHeaders,
    };
    } catch (error) {
    console.error("Login error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Login failed", error: error instanceof Error ? error.message : "Unknown error" }),
      headers: getCorsHeaders(event),
    };
  }
};
