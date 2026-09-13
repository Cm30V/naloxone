import "server-only";

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "naloxone_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;

type SessionPayload = {
  role: "admin";
  exp: number;
  nonce: string;
};

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Server authentication configuration is incomplete");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function verifyAdminPassword(password: string) {
  const encoded = process.env.ADMIN_PASSWORD_HASH;
  if (!encoded || password.length > 256) return false;

  const [algorithm, salt, expected] = encoded.split(":");
  if (algorithm !== "scrypt" || !salt || !expected) return false;

  try {
    const expectedBytes = Buffer.from(expected, "base64url");
    const actualBytes = scryptSync(
      password,
      Buffer.from(salt, "base64url"),
      expectedBytes.length,
    );
    return (
      expectedBytes.length === actualBytes.length &&
      timingSafeEqual(expectedBytes, actualBytes)
    );
  } catch {
    return false;
  }
}

function createToken() {
  const payload: SessionPayload = {
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function verifyToken(token: string | undefined) {
  if (!token) return false;
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;

  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    return (
      payload.role === "admin" &&
      Number.isFinite(payload.exp) &&
      payload.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return verifyToken(token);
}

export async function createAdminSession() {
  (await cookies()).set(COOKIE_NAME, createToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_SECONDS,
    path: "/",
    priority: "high",
  });
}

export async function deleteAdminSession() {
  (await cookies()).set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}
