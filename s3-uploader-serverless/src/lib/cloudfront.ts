import crypto from "crypto";

/**
 * Helpers to create CloudFront signed cookies (custom policy).
 *
 * Note:
 * - Expects privateKey in PEM format (RSA).
 * - Returns cookie values (not full Set-Cookie strings).
 *
 * Reference policy format:
 * {
 *   "Statement": [
 *     {
 *       "Resource": "https://d111111abcdef8.cloudfront.net/*",
 *       "Condition": {
 *         "DateLessThan": {"AWS:EpochTime": 1357034400}
 *       }
 *     }
 *   ]
 * }
 */

const base64UrlEncode = (buf: Buffer) => {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export const makePolicy = (resource: string, expiresAtEpochSeconds: number) => {
  const policy = {
    Statement: [
      {
        Resource: resource,
        Condition: {
          DateLessThan: {
            "AWS:EpochTime": expiresAtEpochSeconds,
          },
        },
      },
    ],
  };
  return JSON.stringify(policy);
};

export const signPolicy = (policyString: string, privateKeyPem: string) => {
  // CloudFront requires RSA-SHA1 signature for signed cookies/URLs.
  // Use crypto.sign with "RSA-SHA1".
  const signer = crypto.createSign("RSA-SHA1");
  signer.update(policyString);
  signer.end();
  const signature = signer.sign(privateKeyPem);
  return signature;
};

/**
 * Create signed cookie values for a custom policy.
 *
 * @param resource e.g. https://<cloudfront-domain>/* or https://<cloudfront-domain>/path/*
 * @param expiresInSeconds lifetime in seconds from now
 * @param keyPairId public key id (CloudFront key pair id or public key id depending on method)
 * @param privateKeyPem private key in PEM format
 *
 * @returns { policy: string, signature: string, keyPairId: string }
 */
export const getSignedCookies = (resource: string, expiresInSeconds: number, keyPairId: string, privateKeyPem: string) => {
  const expiresAt = Math.floor(Date.now() / 1000) + Math.floor(expiresInSeconds);
  const policy = makePolicy(resource, expiresAt);
  const policyB64 = base64UrlEncode(Buffer.from(policy, "utf8"));
  const signatureBuf = signPolicy(policy, privateKeyPem);
  const signatureB64 = base64UrlEncode(signatureBuf);

  return {
    policy: policyB64,
    signature: signatureB64,
    keyPairId,
    expiresAt,
  };
};
