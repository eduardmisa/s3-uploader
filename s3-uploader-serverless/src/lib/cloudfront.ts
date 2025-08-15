import crypto from "crypto";

/**
 * CloudFront-safe Base64 (for cookies/URLs)
 * Do NOT strip padding. Apply AWS's custom mapping:
 *   '+' -> '-'
 *   '/' -> '~'
 *   '=' -> '_'
 */
const toCloudFrontBase64 = (inputB64: string) =>
  inputB64.replace(/\+/g, "-").replace(/\//g, "~").replace(/=/g, "_");

const toBase64 = (buf: Buffer) => buf.toString("base64");

/** Build a simple custom policy that expires at a given epoch time. */
export const makePolicy = (resource: string, expiresAtEpochSeconds: number) => {
  const policy = {
    Statement: [
      {
        Resource: resource, // e.g., "https://cdn.file-manager.emisa.me/*"
        Condition: {
          DateLessThan: { "AWS:EpochTime": expiresAtEpochSeconds },
        },
      },
    ],
  };
  return JSON.stringify(policy);
};

/**
 * Sign the policy string.
 * For Key Groups (recommended), use "RSA-SHA256".
 * For legacy Key Pairs, use "RSA-SHA1".
 */
export const signPolicy = (
  policyString: string,
  privateKeyPem: string,
  algo: "RSA-SHA256" | "RSA-SHA1" = "RSA-SHA256"
) => {
  const signer = crypto.createSign(algo);
  signer.update(policyString, "utf8");
  const signature = signer.sign(privateKeyPem); // Buffer
  return signature;
};

/**
 * Create CloudFront signed cookie values (not full Set-Cookie headers).
 *
 * @param resource   e.g. "https://cdn.file-manager.emisa.me/*" or with a path prefix
 * @param expiresInSeconds  lifetime from now, in seconds
 * @param keyPairId  For Key Groups, this is the Public Key ID; for legacy, the Key Pair ID
 * @param privateKeyPem PEM private key matching the public key in the trusted key group (or key pair)
 * @param algo optional: "RSA-SHA256" (default) or "RSA-SHA1" for legacy key pairs
 */
export const getSignedCookies = (
  resource: string,
  expiresInSeconds: number,
  keyPairId: string,
  privateKeyPem: string,
  algo: "RSA-SHA256" | "RSA-SHA1" = "RSA-SHA256"
) => {
  const expiresAt = Math.floor(Date.now() / 1000) + Math.floor(expiresInSeconds);

  // 1) Policy JSON
  const policy = makePolicy(resource, expiresAt);

  // 2) Base64 -> CloudFront-safe for Policy
  const policyB64 = toBase64(Buffer.from(policy, "utf8"));
  const policyCF = toCloudFrontBase64(policyB64);

  // 3) Sign policy with RSA (SHA256 default)
  const signatureBuf = signPolicy(policy, privateKeyPem, algo);

  // 4) Base64 -> CloudFront-safe for Signature
  const signatureB64 = toBase64(signatureBuf);
  const signatureCF = toCloudFrontBase64(signatureB64);

  return {
    policy: policyCF,          // CloudFront-Policy cookie value
    signature: signatureCF,    // CloudFront-Signature cookie value
    keyPairId,                 // CloudFront-Key-Pair-Id cookie value
    expiresAt,
  };
};
