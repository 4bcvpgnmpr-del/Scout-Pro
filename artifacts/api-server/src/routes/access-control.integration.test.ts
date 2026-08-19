import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";
import app from "../app.js";

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "registration must issue a session cookie");

  const cookie = setCookie.split(";", 1)[0];
  assert.ok(cookie?.startsWith("connect.sid="), "expected a connect.sid cookie");
  return cookie;
}

test("keeps scouting routes private while preserving the session lifecycle", async () => {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const email = `access-control-${randomUUID()}@example.test`;

  try {
    const health = await fetch(`${baseUrl}/api/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });

    const protectedResponses = await Promise.all([
      fetch(`${baseUrl}/api/teams`),
      fetch(`${baseUrl}/api/storage/uploads/request-url`, { method: "POST" }),
      fetch(`${baseUrl}/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fplayer.jpg`),
    ]);
    for (const response of protectedResponses) {
      assert.equal(response.status, 401);
    }

    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "integration-test-password",
        name: "Access Control Test",
      }),
    });
    assert.equal(registration.status, 201);

    const cookie = sessionCookie(registration);
    const recoveredSession = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
    });
    assert.equal(recoveredSession.status, 200);
    const recoveredUser = await recoveredSession.json() as { email: string };
    assert.equal(recoveredUser.email, email);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(logout.status, 200);

    const expiredSession = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
    });
    assert.equal(expiredSession.status, 401);
  } finally {
    await db.delete(usersTable).where(eq(usersTable.email, email));
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await pool.end();
  }
});