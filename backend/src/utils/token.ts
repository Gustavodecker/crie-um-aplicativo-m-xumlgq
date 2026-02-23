/**
 * Generate a random 4-character alphanumeric token (uppercase letters and numbers only)
 * Examples: "A3B9", "K7M2"
 */
export function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 4; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
