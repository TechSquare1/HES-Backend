const crypto = require('crypto');

// QR payload format: HES1:<studentId>:<signature>
// The signature is an HMAC of the studentId, so a QR cannot be faked just by
// knowing a student's ID. The same student always gets the same QR, so a lost
// card can be regenerated identically. Never change QR_SECRET once cards are
// printed, or all printed cards stop working.
const PREFIX = 'HES1';
const SIG_LENGTH = 16;

const getQrSecret = () => {
  const secret = process.env.QR_SECRET;
  if (!secret || String(secret).length < 16) {
    throw new Error('QR_SECRET is not configured (16+ characters required)');
  }
  return secret;
};

const sign = (studentId) =>
  crypto
    .createHmac('sha256', getQrSecret())
    .update(String(studentId))
    .digest('base64url')
    .slice(0, SIG_LENGTH);

exports.buildQrPayload = (studentId) => `${PREFIX}:${studentId}:${sign(studentId)}`;

// Returns the studentId when the payload is valid, otherwise null.
exports.parseQrPayload = (text) => {
  if (typeof text !== 'string') return null;
  const value = text.trim();
  const first = value.indexOf(':');
  const last = value.lastIndexOf(':');
  if (first === -1 || last === first) return null;

  const prefix = value.slice(0, first);
  const studentId = value.slice(first + 1, last);
  const sig = value.slice(last + 1);
  if (prefix !== PREFIX || !studentId || sig.length !== SIG_LENGTH) return null;

  const expected = Buffer.from(sign(studentId));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return null;
  }
  return studentId;
};

exports.getQrSecret = getQrSecret;
