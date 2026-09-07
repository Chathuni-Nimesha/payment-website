import "server-only";

import { hash, verify, type Options } from "@node-rs/argon2";

const ARGON2_OPTIONS: Options = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

let dummyHashPromise: Promise<string> | null = null;

export async function hashPassword(password: string) {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

export async function verifyPasswordAgainstKnownHash(
  passwordHash: string | null,
  password: string,
) {
  const hashToCheck = passwordHash ?? (await dummyPasswordHash());
  const matched = await verifyPassword(hashToCheck, password);
  return Boolean(passwordHash) && matched;
}

async function dummyPasswordHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("northline-timing-dummy");
  }

  return dummyHashPromise;
}
