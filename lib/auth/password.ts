import bcrypt from "bcryptjs"

/**
 * Password hashing for the Credentials provider.
 *
 * bcryptjs is a pure-JS implementation (no native bindings), so it runs
 * reliably inside Vercel's Node serverless runtime without a build step.
 */

const SALT_ROUNDS = 12

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
