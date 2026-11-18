// Creates the synthetic accounts through the local auth API. The role is written to app_metadata.
import { JOBSEEKERS, PASSWORD, SIGNUP_JOBSEEKER, STAFF } from "./ids.mjs";

async function authFetch(stack, path, { key, method = "POST", body }) {
  const res = await fetch(`${stack.apiUrl}/auth/v1${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function adminBody(account, userType, userRole) {
  return {
    id: account.id,
    email: account.email,
    password: PASSWORD,
    email_confirm: true,
    phone: undefined,
    app_metadata: { user_type: userType, user_role: userRole },
    // what the portal screens read; the server writes the same values to both
    user_metadata: {
      name: account.name,
      phoneNumber: account.mobile,
      user_type: userType,
      user_role: userRole,
    },
  };
}

export async function createUsers(stack) {
  for (const account of Object.values(STAFF)) {
    const r = await authFetch(stack, "/admin/users", {
      key: stack.serviceKey,
      body: adminBody(
        { ...account, mobile: "+15555550100" },
        account.userType,
        account.userRole
      ),
    });
    if (r.status >= 300)
      throw new Error(
        `creating ${account.email} failed: ${r.status} ${JSON.stringify(r.json)}`
      );
  }
  for (const account of Object.values(JOBSEEKERS)) {
    const r = await authFetch(stack, "/admin/users", {
      key: stack.serviceKey,
      body: adminBody(account, "jobseeker", []),
    });
    if (r.status >= 300)
      throw new Error(
        `creating ${account.email} failed: ${r.status} ${JSON.stringify(r.json)}`
      );
  }
  // Open sign-up: no role is sent; the database trigger from 034 gives the jobseeker role.
  const signup = await authFetch(stack, "/signup", {
    key: stack.anonKey,
    body: {
      email: SIGNUP_JOBSEEKER.email,
      password: PASSWORD,
      data: {
        name: SIGNUP_JOBSEEKER.name,
        phoneNumber: SIGNUP_JOBSEEKER.mobile,
      },
    },
  });
  if (signup.status >= 300)
    throw new Error(
      `open sign-up failed: ${signup.status} ${JSON.stringify(signup.json)}`
    );
  return { signupUserId: signup.json.user?.id ?? signup.json.id };
}

/** Signs in with email and password; returns the access token. */
export async function signIn(stack, email, password = PASSWORD) {
  const r = await authFetch(stack, "/token?grant_type=password", {
    key: stack.anonKey,
    body: { email, password },
  });
  if (r.status !== 200)
    throw new Error(
      `sign-in of ${email} failed: ${r.status} ${JSON.stringify(r.json)}`
    );
  return r.json.access_token;
}
