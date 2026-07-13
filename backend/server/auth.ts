import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { db, type User } from './db.js';

const jwtSecret = process.env.JWT_SECRET?.trim();
if (process.env.NODE_ENV === 'production' && (!jwtSecret || jwtSecret === 'replace-with-a-long-random-secret')) {
  throw new Error('JWT_SECRET must be set to a strong value in production.');
}
const JWT_SECRET = jwtSecret || 'nova-local-development-secret-change-me';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
if (!jwtSecret) console.warn('[Auth] JWT_SECRET is not set. Using the local development secret.');

const encode = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const sign = (input: string) => crypto.createHmac('sha256', JWT_SECRET).update(input).digest('base64url');

export function createToken(user: User): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encode(JSON.stringify({ sub: user.id, email: user.email, name: user.name, iat: now, exp: now + TOKEN_TTL_SECONDS }));
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifyToken(token: string): User | null {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    const expected = sign(`${header}.${payload}`);
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (!claims.sub || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return db.findUserById(claims.sub) ?? null;
  } catch { return null; }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, expected] = stored.split(':');
    const actual = crypto.pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

export interface AuthenticatedRequest extends Request { user?: User }

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const user = token ? verifyToken(token) : null;
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  req.user = user;
  next();
}

export const publicUser = (user: User) => ({ id: user.id, name: user.name, email: user.email, created_at: user.created_at });

