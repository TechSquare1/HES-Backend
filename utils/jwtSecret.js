/**
 * Single source for JWT signing/verification secret.
 * Production must set JWT_SECRET (no insecure fallback).
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || String(secret).length < 24) {
      throw new Error(
        'JWT_SECRET must be set to a strong value (24+ characters) when NODE_ENV=production'
      );
    }
    return secret;
  }
  return secret || 'maktabkhalidbinwaleedjwtSecret';
}

module.exports = { getJwtSecret };
