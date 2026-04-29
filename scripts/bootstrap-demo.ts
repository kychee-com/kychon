/**
 * Bootstrap demo accounts for a Kychon demo site.
 *
 * Creates `demo-admin@kychon.com` and `demo-member@kychon.com` auth users,
 * triggers `on-signup` for each (so they get linked to a `members` row),
 * promotes admin / activates member, and stores both user_ids in
 * `site_config.demo_accounts`. Idempotent — re-running just re-asserts state.
 *
 * Used by `deploy-demo.ts`. No Run402 CLI shell-outs — uses the SDK to fetch
 * keys and Node's built-in `fetch` for the project-scoped REST endpoints
 * (PostgREST / GoTrue / functions) that the SDK doesn't wrap.
 */

import type { Run402Instance } from "./_lib.ts";

const API = "https://api.run402.com";
const ADMIN_EMAIL = "demo-admin@kychon.com";
const MEMBER_EMAIL = "demo-member@kychon.com";
const DEMO_PASSWORD = "demo123";

export interface BootstrapResult {
  adminUserId: string;
  memberUserId: string;
}

export async function bootstrapDemoAccounts(
  r: Run402Instance,
  projectId: string,
): Promise<BootstrapResult> {
  console.log("=== Bootstrap Demo Accounts ===");
  console.log(`Project: ${projectId}`);

  const keys = await r.projects.keys(projectId);
  const anonKey = keys.anon_key;
  const serviceKey = keys.service_key;
  if (!anonKey) throw new Error(`No anon_key for project ${projectId}`);
  if (!serviceKey) throw new Error(`No service_key for project ${projectId}`);

  console.log("\nStep 1: Creating demo accounts...");
  const adminUserId = await getUserId(anonKey, ADMIN_EMAIL, DEMO_PASSWORD);
  const memberUserId = await getUserId(anonKey, MEMBER_EMAIL, DEMO_PASSWORD);
  console.log(`  Admin:  ${adminUserId}`);
  console.log(`  Member: ${memberUserId}`);

  console.log("\nStep 2: Triggering on-signup...");
  await triggerOnSignup(anonKey, ADMIN_EMAIL, DEMO_PASSWORD);
  console.log("  on-signup called for admin");
  await triggerOnSignup(anonKey, MEMBER_EMAIL, DEMO_PASSWORD);
  console.log("  on-signup called for member");

  console.log("\nStep 3: Setting roles...");
  await patchMember(anonKey, serviceKey, adminUserId, { role: "admin", status: "active" });
  console.log("  Admin: role=admin, status=active");
  await patchMember(anonKey, serviceKey, memberUserId, { status: "active" });
  console.log("  Member: status=active");

  console.log("\nStep 4: Storing demo_accounts in site_config...");
  await storeDemoAccounts(anonKey, serviceKey, adminUserId, memberUserId);
  console.log("  Stored demo_accounts config");

  console.log("\n=== Done! ===");
  console.log(`Admin:  ${ADMIN_EMAIL} / ${DEMO_PASSWORD} (user_id: ${adminUserId})`);
  console.log(`Member: ${MEMBER_EMAIL} / ${DEMO_PASSWORD} (user_id: ${memberUserId})`);

  return { adminUserId, memberUserId };
}

/** Sign up the user; on conflict, sign in instead. Returns the user id either way. */
async function getUserId(anonKey: string, email: string, password: string): Promise<string> {
  const signupRes = await fetch(`${API}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email, password }),
  });
  const signupBody = (await signupRes.json().catch(() => ({}))) as {
    id?: string;
    user?: { id?: string };
  };
  const signupId = signupBody.id ?? signupBody.user?.id;
  if (signupId) {
    console.log(`  Created: ${email} → ${signupId}`);
    return signupId;
  }

  const signinRes = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email, password }),
  });
  const signinBody = (await signinRes.json().catch(() => ({}))) as {
    user?: { id?: string };
  };
  const signinId = signinBody.user?.id;
  if (signinId) {
    console.log(`  Exists: ${email} → ${signinId}`);
    return signinId;
  }

  throw new Error(
    `Could not create or sign in ${email}.\n  signup: ${JSON.stringify(signupBody)}\n  signin: ${JSON.stringify(signinBody)}`,
  );
}

/** Sign in to get an access token, then call /functions/v1/on-signup. */
async function triggerOnSignup(anonKey: string, email: string, password: string): Promise<void> {
  const tokRes = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email, password }),
  });
  const tokBody = (await tokRes.json().catch(() => ({}))) as { access_token?: string };
  const token = tokBody.access_token;
  if (!token) return;

  await fetch(`${API}/functions/v1/on-signup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
}

// Service-key writes go through `/admin/v1/rest/*`. The PostgREST-shaped
// `/rest/v1/*` endpoint rejects service_role with HTTP 403 ("service_role is
// not permitted on /rest/v1/*"). The pre-port bash version was silently
// swallowing this 403 via `> /dev/null`.
async function patchMember(
  anonKey: string,
  serviceKey: string,
  userId: string,
  patch: Record<string, string>,
): Promise<void> {
  const res = await fetch(`${API}/admin/v1/rest/members?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(
      `PATCH /admin/v1/rest/members failed: HTTP ${res.status} ${res.statusText} — ${await res.text()}`,
    );
  }
}

async function storeDemoAccounts(
  anonKey: string,
  serviceKey: string,
  adminUserId: string,
  memberUserId: string,
): Promise<void> {
  const res = await fetch(`${API}/admin/v1/rest/site_config`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      key: "demo_accounts",
      value: { admin_user_id: adminUserId, member_user_id: memberUserId },
      category: "demo",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `POST /admin/v1/rest/site_config failed: HTTP ${res.status} ${res.statusText} — ${await res.text()}`,
    );
  }
}
