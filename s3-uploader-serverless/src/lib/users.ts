import bcrypt from "bcryptjs";

export interface User {
  email: string;
  passwordHash: string;
  name?: string;
}

/**
 * Loads users from environment variables:
 * - Preferred: AUTH_USERS as a JSON array string: [{ "email": "...", "passwordHash": "...", "name": "..." }]
 * - Fallback: ADMIN_EMAIL + (ADMIN_PASSWORD_HASH || ADMIN_PASSWORD)
 *   - If ADMIN_PASSWORD is provided (plaintext), it will be hashed at startup (using bcrypt sync).
 *
 * NOTE: For production, use a real user store (DynamoDB, RDS, Cognito, etc).
 */
const loadUsers = (): User[] => {
  if (process.env.AUTH_USERS) {
    try {
      const parsed = JSON.parse(process.env.AUTH_USERS);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => ({
          email: String(u.email).toLowerCase(),
          passwordHash: String(u.passwordHash),
          name: u.name,
        }));
      }
    } catch (e) {
      console.warn("Failed to parse AUTH_USERS, falling back to ADMIN_* env vars");
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && (adminPasswordHash || adminPassword)) {
    const passwordHash = adminPasswordHash
      ? adminPasswordHash
      : bcrypt.hashSync(adminPassword as string, 10);
    return [
      {
        email: String(adminEmail).toLowerCase(),
        passwordHash,
        name: process.env.ADMIN_NAME || "admin",
      },
    ];
  }

  // No configured users — return empty list
  return [];
};

const USERS = loadUsers();

export const getUserByEmail = (email?: string): User | undefined => {
  if (!email) return undefined;
  return USERS.find((u) => u.email === String(email).toLowerCase());
};

export const listUsers = (): User[] => USERS;
