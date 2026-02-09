import * as jose from "jose";
import type { Role } from "./roles.js";

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
  email: string;
}

let _secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (!_secret) {
    const raw = process.env.JWT_SECRET;
    if (!raw) throw new Error("JWT_SECRET is required");
    _secret = new TextEncoder().encode(raw);
  }
  return _secret;
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const issuer = process.env.JWT_ISSUER ?? "beacon-os";
  const audience = process.env.JWT_AUDIENCE ?? "beacon-os-api";

  const { payload } = await jose.jwtVerify(token, getSecret(), {
    issuer,
    audience,
  });

  return {
    sub: payload.sub!,
    tenantId: payload.tenantId as string,
    role: payload.role as Role,
    email: payload.email as string,
  };
}

export async function signJwt(payload: JwtPayload, expiresIn = "8h"): Promise<string> {
  const issuer = process.env.JWT_ISSUER ?? "beacon-os";
  const audience = process.env.JWT_AUDIENCE ?? "beacon-os-api";

  return new jose.SignJWT({
    tenantId: payload.tenantId,
    role: payload.role,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}
