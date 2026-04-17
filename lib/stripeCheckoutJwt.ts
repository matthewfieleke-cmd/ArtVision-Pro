import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const JWT_ALG = 'HS256';
const JWT_ISS = 'artvision-pro';
const JWT_AUD = 'paid-api';

export type StripeCheckoutJwtClaims = JWTPayload & {
  pi: string;
  typ: 'critique' | 'preview_edit';
};

export async function signCheckoutAuthorizationJwt(args: {
  secret: string;
  paymentIntentId: string;
  typ: 'critique' | 'preview_edit';
  /** Seconds from now (default 15 minutes). */
  ttlSeconds?: number;
}): Promise<string> {
  const enc = new TextEncoder().encode(args.secret);
  const ttl = args.ttlSeconds ?? 15 * 60;
  return new SignJWT({ pi: args.paymentIntentId, typ: args.typ })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setIssuer(JWT_ISS)
    .setAudience(JWT_AUD)
    .setExpirationTime(`${ttl}s`)
    .sign(enc);
}

export async function verifyCheckoutAuthorizationJwt(
  token: string,
  secret: string
): Promise<StripeCheckoutJwtClaims> {
  const enc = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, enc, {
    issuer: JWT_ISS,
    audience: JWT_AUD,
    algorithms: [JWT_ALG],
  });
  const pi = typeof payload.pi === 'string' ? payload.pi : '';
  const typ = payload.typ === 'critique' || payload.typ === 'preview_edit' ? payload.typ : null;
  if (!pi || !typ) {
    throw new Error('Invalid checkout authorization token');
  }
  return { ...payload, pi, typ };
}
