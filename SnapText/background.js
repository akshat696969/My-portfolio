const SUPABASE_URL = "https://bowwduxdrtauyawamzad.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvd3dkdXhkcnRhdXlhd2FtemFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzY0NDIsImV4cCI6MjA4OTYxMjQ0Mn0.z18Y8cC9CvbTnOLsSw7tGj04xEdYBM2MCbFYeG8tA74";
const STORAGE_KEYS = {
  NOTES: "localNotes",
  AUTH: "authSession",
  CUSTOM_TAGS: "customTags",
  RECYCLE_BIN: "recycleBinNotes",
  PLAN: "userPlan",
  PRO_LICENSE: "proLicense",
  IS_PRO: "isPro",
  LICENSE_KEY: "licenseKey",
  LICENSE_LAST_VERIFIED_AT: "licenseLastVerifiedAt"
};
const LICENSE_RECHECK_ALARM = "license-recheck";
const LICENSE_RECHECK_PERIOD_MINUTES = 12 * 60;
const FREE_PLAN = {
  tier: "free",
  label: "Free",
  maxNotes: 25,
  maxNoteCharacters: 700,
  allowedExportFormats: ["pdf"]
};
const PRO_PLAN = {
  tier: "pro",
  label: "Pro",
  maxNotes: 100,
  maxNoteCharacters: 5000,
  allowedExportFormats: ["pdf", "csv", "excel", "markdown"]
};
const LIFETIME_PRO_EMAILS = new Set(["akshatyadav.srcc@gmail.com"]);
const SESSION_VALIDATION_TTL_MS = 60 * 1000;
const RECYCLE_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const FREE_OVERFLOW_GRACE_MS = 60 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_WINDOW_MS = 5 * 60 * 1000;
let validatedSessionCache = {
  token: null,
  validatedAt: 0
};

function isSupabaseConfigured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_ANON_KEY &&
    SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY"
  );
}

function isJwtExpiredError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("JWT expired") ||
    message.includes("PGRST303") ||
    message.includes("bad_jwt") ||
    message.includes("token is expired")
  );
}

function isUserCancelledLogin(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("did not approve access") ||
    message.includes("user did not approve") ||
    message.includes("authorization page could not be loaded") ||
    message.includes("canceled") ||
    message.includes("cancelled") ||
    message.includes("closed")
  );
}

function getStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        resolve(undefined);
        return;
      }
      resolve(result ? result[key] : undefined);
    });
  });
}

function setStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve());
  });
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag || "").trim()).filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  const raw = value.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag || "").trim()).filter(Boolean);
    }
    if (typeof parsed === "string") {
      return parsed ? [parsed.trim()] : [];
    }
  } catch {
    // Continue with non-JSON parsing.
  }

  if (raw.startsWith("{") && raw.endsWith("}")) {
    return raw
      .slice(1, -1)
      .split(",")
      .map((tag) => tag.replace(/^"(.*)"$/, "$1").trim())
      .filter(Boolean);
  }

  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [raw];
}

function makeNoteFingerprint(note) {
  // Use second-level precision to avoid tiny formatting differences.
  const timestamp = new Date(note.created_at).toISOString().slice(0, 19);
  return `${note.text}||${note.url}||${timestamp}`;
}

function toBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (const value of values) {
    result += chars[value % chars.length];
  }
  return result;
}

async function makeCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toBase64Url(digest);
}

async function supabaseRequest(path, { method = "GET", token, body, headers: extraHeaders } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...(extraHeaders || {})
  };

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase error (${response.status})`);
  }

  return response.status === 204 ? null : response.json();
}

async function getAuthSession() {
  return (await getStorage(STORAGE_KEYS.AUTH)) || null;
}

function getPlanForEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return LIFETIME_PRO_EMAILS.has(normalized) ? { ...PRO_PLAN } : { ...FREE_PLAN };
}

async function getStoredLicenseState(session = null) {
  const licenseState = await getStorage(STORAGE_KEYS.PRO_LICENSE);
  if (licenseState && typeof licenseState === "object") {
    if (session?.user?.id) {
      if (!licenseState.userId || licenseState.userId !== session.user.id) {
        await clearStoredLicenseState();
      } else {
        return licenseState;
      }
    } else {
      return null;
    }
  }

  if (session?.access_token && session?.user?.id) {
    const subscription = await fetchUserSubscription(session);
    if (subscription?.plan === "pro" && subscription.license_key) {
      const reconstructed = {
        activated: true,
        licenseKey: subscription.license_key,
        userId: session.user.id,
        verifiedAt: subscription.license_verified_at || null
      };
      await storeLicenseState(reconstructed);
      return reconstructed;
    }
  }

  return null;
}

async function clearStoredLicenseState() {
  await setStorage({
    [STORAGE_KEYS.PRO_LICENSE]: null,
    [STORAGE_KEYS.IS_PRO]: false,
    [STORAGE_KEYS.LICENSE_KEY]: null,
    [STORAGE_KEYS.LICENSE_LAST_VERIFIED_AT]: null
  });
}

async function storeLicenseState(licenseState) {
  await setStorage({
    [STORAGE_KEYS.PRO_LICENSE]: licenseState,
    [STORAGE_KEYS.IS_PRO]: Boolean(licenseState?.activated),
    [STORAGE_KEYS.LICENSE_KEY]: licenseState?.licenseKey || null,
    [STORAGE_KEYS.LICENSE_LAST_VERIFIED_AT]: licenseState?.verifiedAt || null
  });
}

async function fetchUserSubscription(session) {
  if (!isSupabaseConfigured() || !session?.access_token || !session?.user?.id) {
    return null;
  }

  try {
    let rows;
    try {
      rows = await supabaseRequest(
        `/rest/v1/user_subscriptions?select=user_id,plan,license_key,license_verified_at,downgraded_at&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
        {
          method: "GET",
          token: session.access_token
        }
      );
    } catch (error) {
      const message = String(error?.message || "");
      if (!message.includes("downgraded_at")) {
        throw error;
      }

      rows = await supabaseRequest(
        `/rest/v1/user_subscriptions?select=user_id,plan,license_key,license_verified_at&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
        {
          method: "GET",
          token: session.access_token
        }
      );
    }
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("relation") && message.includes("user_subscriptions")) {
      return null;
    }
    throw error;
  }
}

async function upsertUserSubscription(
  session,
  { plan, licenseKey = null, verifiedAt = null, downgradedAt = undefined } = {}
) {
  if (!isSupabaseConfigured() || !session?.access_token || !session?.user?.id) {
    throw new Error("Sign in with Google before activating Pro.");
  }

  const request = {
    method: "POST",
    token: session.access_token,
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    }
  };
  const body = {
    user_id: session.user.id,
    plan,
    license_key: licenseKey,
    license_source: licenseKey ? "gumroad" : null,
    license_verified_at: verifiedAt,
    downgraded_at: downgradedAt
  };

  try {
    await supabaseRequest("/rest/v1/user_subscriptions", {
      ...request,
      body
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("downgraded_at")) {
      throw error;
    }

    const fallbackBody = { ...body };
    delete fallbackBody.downgraded_at;
    await supabaseRequest("/rest/v1/user_subscriptions", {
      ...request,
      body: fallbackBody
    });
  }
}

async function moveCombinedNoteToRecycleBin(note, session) {
  const fingerprint = makeNoteFingerprint(note);
  await deleteLocalNotesByFingerprint(fingerprint);

  if (note.source === "cloud" && session?.access_token && session?.user?.id) {
    await softDeleteCloudNote(note, session);
    return;
  }

  await moveNoteToRecycleBin(note);
}

async function enforceFreePlanOverflowPolicy(session = null) {
  if (!session?.access_token || !session?.user?.id) {
    return { moved: 0 };
  }

  const subscription = await fetchUserSubscription(session);
  if (subscription?.plan !== "free" || !subscription?.downgraded_at) {
    return { moved: 0 };
  }

  const downgradedAt = new Date(subscription.downgraded_at).getTime();
  if (!Number.isFinite(downgradedAt) || Date.now() - downgradedAt < FREE_OVERFLOW_GRACE_MS) {
    return { moved: 0 };
  }

  const notes = await getCombinedNotes();
  if (notes.length <= FREE_PLAN.maxNotes) {
    return { moved: 0 };
  }

  const overflowNotes = notes
    .slice(FREE_PLAN.maxNotes)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  for (const note of overflowNotes) {
    await moveCombinedNoteToRecycleBin(note, session);
  }

  return { moved: overflowNotes.length };
}

async function getEffectivePlan(session = null) {
  const emailPlan = getPlanForEmail(session?.user?.email);
  if (emailPlan.tier === "pro") {
    return emailPlan;
  }

  const subscription = await fetchUserSubscription(session);
  if (subscription?.plan === "pro") {
    return { ...PRO_PLAN };
  }

  const licenseState = session ? await getStoredLicenseState(session) : null;
  if (licenseState?.activated && licenseState?.licenseKey) {
    return { ...PRO_PLAN };
  }

  return { ...FREE_PLAN };
}

async function syncStoredPlan(session = null) {
  const plan = await getEffectivePlan(session);
  await setStorage({ [STORAGE_KEYS.PLAN]: plan });
  return plan;
}

async function verifyGumroadLicenseWithEdgeFunction(licenseKey, userId = "") {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-gumroad-license`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      licenseKey,
      license_key: licenseKey,
      userId,
      user_id: userId
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `License verification failed (${response.status}).`);
  }

  return {
    ...data,
    success: data?.success === true || data?.valid === true
  };
}

async function activateProLicense(licenseKey) {
  const session = await getValidAuthSession();
  if (!session?.access_token || !session?.user?.id) {
    throw new Error("Sign in with Google before activating Pro.");
  }

  const result = await verifyGumroadLicenseWithEdgeFunction(licenseKey, session.user.id);
  if (!result?.success) {
    await clearStoredLicenseState();
    await upsertUserSubscription(session, { plan: "free" });
    const plan = await syncStoredPlan(session);
    return {
      success: false,
      licenseState: null,
      plan
    };
  }

  const licenseState = {
    activated: true,
    licenseKey,
    userId: session.user.id,
    verifiedAt: new Date().toISOString()
  };

  await upsertUserSubscription(session, {
    plan: "pro",
    licenseKey,
    verifiedAt: licenseState.verifiedAt,
    downgradedAt: null
  });
  await ensureLicenseRecheckAlarm();
  await storeLicenseState(licenseState);
  const plan = await syncStoredPlan(session);
  return { success: true, licenseState, plan };
}

async function ensureLicenseRecheckAlarm() {
  return new Promise((resolve) => {
    chrome.alarms.create(LICENSE_RECHECK_ALARM, {
      periodInMinutes: LICENSE_RECHECK_PERIOD_MINUTES
    });
    resolve();
  });
}

async function revalidateStoredLicense() {
  const session = await getValidAuthSession();
  const licenseState = await getStoredLicenseState(session);
  if (!licenseState?.activated || !licenseState?.licenseKey) {
    const plan = await syncStoredPlan(session);
    return { success: false, downgraded: false, plan, licenseState: null };
  }

  try {
    const result = await verifyGumroadLicenseWithEdgeFunction(licenseState.licenseKey, session.user.id);
    if (!result?.success) {
      await clearStoredLicenseState();
      if (session?.access_token && session?.user?.id) {
        await upsertUserSubscription(session, {
          plan: "free",
          licenseKey: licenseState.licenseKey,
          downgradedAt: new Date().toISOString()
        });
      }
      const plan = await syncStoredPlan(session);
      return { success: false, downgraded: true, plan, licenseState: null };
    }

    const nextLicenseState = {
      ...licenseState,
      activated: true,
      verifiedAt: new Date().toISOString()
    };
    await storeLicenseState(nextLicenseState);
    await upsertUserSubscription(session, {
      plan: "pro",
      licenseKey: nextLicenseState.licenseKey,
      verifiedAt: nextLicenseState.verifiedAt,
      downgradedAt: null
    });
    await ensureLicenseRecheckAlarm();
    const plan = await syncStoredPlan(session);
    return { success: true, downgraded: false, plan, licenseState: nextLicenseState };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
  }
}

function sessionNeedsRefresh(session) {
  if (!session?.refresh_token || !session?.expires_at) {
    return false;
  }

  return session.expires_at * 1000 <= Date.now() + SESSION_REFRESH_WINDOW_MS;
}

async function refreshAuthSession(session) {
  if (!session?.refresh_token) {
    return null;
  }

  const tokenResponse = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: {
      refresh_token: session.refresh_token
    }
  });

  if (!tokenResponse?.access_token) {
    throw new Error("Session refresh failed.");
  }

  return buildAndStoreSession(tokenResponse);
}

async function getValidAuthSession() {
  let session = await getAuthSession();
  if (!session?.access_token || !session?.user?.id) {
    return null;
  }

  if (sessionNeedsRefresh(session)) {
    try {
      session = await refreshAuthSession(session);
    } catch (error) {
      if (isJwtExpiredError(error) || String(error?.message || "").includes("refresh")) {
        await logout();
        validatedSessionCache = { token: null, validatedAt: 0 };
        return null;
      }
      throw error;
    }
  }

  if (
    validatedSessionCache.token === session.access_token &&
    Date.now() - validatedSessionCache.validatedAt < SESSION_VALIDATION_TTL_MS
  ) {
    return session;
  }

  try {
    await supabaseRequest("/auth/v1/user", {
      method: "GET",
      token: session.access_token
    });
    validatedSessionCache = {
      token: session.access_token,
      validatedAt: Date.now()
    };
    return session;
  } catch (error) {
    if (isJwtExpiredError(error) || String(error?.message || "").includes("401")) {
      if (session.refresh_token) {
        try {
          const refreshed = await refreshAuthSession(session);
          validatedSessionCache = {
            token: refreshed.access_token,
            validatedAt: Date.now()
          };
          return refreshed;
        } catch {
          await logout();
          validatedSessionCache = { token: null, validatedAt: 0 };
          return null;
        }
      }
      await logout();
      validatedSessionCache = { token: null, validatedAt: 0 };
      return null;
    }
    throw error;
  }
}

async function buildAndStoreSession(sessionLike) {
  const accessToken =
    typeof sessionLike === "string" ? sessionLike : sessionLike?.access_token;
  if (!accessToken) {
    throw new Error("Access token is required.");
  }

  const user = await supabaseRequest("/auth/v1/user", {
    method: "GET",
    token: accessToken
  });

  const session = {
    access_token: accessToken,
    refresh_token:
      typeof sessionLike === "object" && sessionLike?.refresh_token
        ? sessionLike.refresh_token
        : null,
    expires_at:
      typeof sessionLike === "object" && Number.isFinite(sessionLike?.expires_at)
        ? sessionLike.expires_at
        : null,
    user: {
      id: user.id,
      email: user.email || ""
    }
  };

  await setStorage({ [STORAGE_KEYS.AUTH]: session });
  await syncStoredPlan(session);
  validatedSessionCache = {
    token: session.access_token,
    validatedAt: Date.now()
  };
  return session;
}

async function saveLocalNote(note) {
  const notes = (await getStorage(STORAGE_KEYS.NOTES)) || [];
  const newNote = {
    id: crypto.randomUUID(),
    text: note.text,
    url: note.url,
    title: note.title,
    tags: normalizeTags(note.tags),
    domain: extractDomain(note.url),
    created_at: note.createdAt || new Date().toISOString(),
    source: "local",
    synced_cloud: false
  };

  notes.unshift(newNote);
  await setStorage({ [STORAGE_KEYS.NOTES]: notes });
  await syncCustomTagsFromNotes(notes);

  return newNote;
}

function mergedTagsFromNotes(notes = []) {
  return [
    ...new Set(
      notes
        .flatMap((note) => normalizeTags(note.tags))
        .map((tag) => String(tag || "").trim())
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b));
}

async function syncCustomTagsFromNotes(notes = []) {
  const current = await getStorage(STORAGE_KEYS.CUSTOM_TAGS);
  const currentTags = Array.isArray(current) ? current : [];
  const tagsFromNotes = mergedTagsFromNotes(notes);
  const merged = [...new Set([...currentTags, ...tagsFromNotes])].sort((a, b) => a.localeCompare(b));
  const changed =
    merged.length !== currentTags.length || merged.some((tag, idx) => tag !== currentTags[idx]);
  if (changed) {
    await setStorage({ [STORAGE_KEYS.CUSTOM_TAGS]: merged });
  }
}

async function syncNoteToCloud(localNote) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const session = await getValidAuthSession();
  if (!session?.access_token || !session?.user?.id) {
    return null;
  }

  try {
    await supabaseRequest("/rest/v1/notes", {
      method: "POST",
      token: session.access_token,
      headers: {
        Prefer: "return=representation"
      },
      body: {
        user_id: session.user.id,
        text: localNote.text,
        url: localNote.url,
        created_at: localNote.created_at,
        tags: normalizeTags(localNote.tags)
      }
    });
  } catch (error) {
    // Backward compatibility if `tags` column does not exist yet.
    if (String(error?.message || "").includes("column") && String(error?.message || "").includes("tags")) {
      await supabaseRequest("/rest/v1/notes", {
        method: "POST",
        token: session.access_token,
        headers: {
          Prefer: "return=representation"
        },
        body: {
          user_id: session.user.id,
          text: localNote.text,
          url: localNote.url,
          created_at: localNote.created_at
        }
      });
    } else {
      if (isJwtExpiredError(error)) {
        await logout();
      }
      throw error;
    }
  }

  const notes = (await getStorage(STORAGE_KEYS.NOTES)) || [];
  const updated = notes.map((note) =>
    note.id === localNote.id ? { ...note, synced_cloud: true, tags: normalizeTags(localNote.tags) } : note
  );
  await setStorage({ [STORAGE_KEYS.NOTES]: updated });
  return true;
}

async function syncUnsyncedLocalNotes() {
  const localNotes = (await getStorage(STORAGE_KEYS.NOTES)) || [];
  const unsynced = localNotes.filter((note) => !note.synced_cloud);
  await Promise.all(
    unsynced.map(async (note) => {
      try {
        await syncNoteToCloud(note);
      } catch (error) {
        // Keep trying best-effort for other notes; caller can still proceed.
        console.warn("Cloud sync skipped for a note:", error.message);
      }
    })
  );
}

async function runStartupSync() {
  const session = await getValidAuthSession();
  if (!session?.access_token || !session?.user?.id) {
    return { synced: 0, session: null };
  }

  const localNotes = (await getStorage(STORAGE_KEYS.NOTES)) || [];
  const unsynced = localNotes.filter((note) => !note.synced_cloud);
  if (!unsynced.length) {
    return { synced: 0, session };
  }

  let synced = 0;
  await Promise.all(
    unsynced.map(async (note) => {
      try {
        await syncNoteToCloud(note);
        synced += 1;
      } catch (error) {
        console.warn("Startup sync skipped for a note:", error.message);
      }
    })
  );

  const overflow = await enforceFreePlanOverflowPolicy(session);
  return { synced, session, overflowMoved: overflow.moved };
}

async function removeTagFromLocalNotes(tag) {
  const notes = (await getStorage(STORAGE_KEYS.NOTES)) || [];
  const updated = notes.map((note) => ({
    ...note,
    tags: normalizeTags(note.tags).filter((item) => item !== tag)
  }));
  await setStorage({ [STORAGE_KEYS.NOTES]: updated });
}

async function deleteLocalNotesByTag(tag) {
  const notes = (await getStorage(STORAGE_KEYS.NOTES)) || [];
  const filtered = notes.filter((note) => !normalizeTags(note.tags).includes(tag));
  await setStorage({ [STORAGE_KEYS.NOTES]: filtered });
}

async function deleteLocalNotesByFingerprint(fingerprint) {
  const notes = (await getStorage(STORAGE_KEYS.NOTES)) || [];
  const filtered = notes.filter((note) => makeNoteFingerprint(note) !== fingerprint);
  await setStorage({ [STORAGE_KEYS.NOTES]: filtered });
}

async function deleteCloudNotesByFingerprint(noteLike, session) {
  if (!session?.access_token || !isSupabaseConfigured()) return;
  const text = encodeURIComponent(noteLike.text || "");
  const url = encodeURIComponent(noteLike.url || "");
  const createdAt = encodeURIComponent(noteLike.created_at || "");
  const userId = encodeURIComponent(session.user.id);
  await supabaseRequest(
    `/rest/v1/notes?user_id=eq.${userId}&text=eq.${text}&url=eq.${url}&created_at=eq.${createdAt}`,
    {
      method: "DELETE",
      token: session.access_token
    }
  );
}

function recycleExpiryIso() {
  return new Date(Date.now() + RECYCLE_RETENTION_MS).toISOString();
}

async function softDeleteCloudNote(noteLike, session) {
  if (!session?.access_token || !isSupabaseConfigured()) return;

  const deletedAt = new Date().toISOString();
  const expiresAt = recycleExpiryIso();
  const userId = encodeURIComponent(session.user.id);

  if (noteLike.source === "cloud" && noteLike.id) {
    await supabaseRequest(`/rest/v1/notes?id=eq.${encodeURIComponent(noteLike.id)}&user_id=eq.${userId}`, {
      method: "PATCH",
      token: session.access_token,
      body: {
        deleted_at: deletedAt,
        recycle_expires_at: expiresAt
      }
    });
    return;
  }

  const text = encodeURIComponent(noteLike.text || "");
  const url = encodeURIComponent(noteLike.url || "");
  const createdAt = encodeURIComponent(noteLike.created_at || "");
  await supabaseRequest(
    `/rest/v1/notes?user_id=eq.${userId}&text=eq.${text}&url=eq.${url}&created_at=eq.${createdAt}`,
    {
      method: "PATCH",
      token: session.access_token,
      body: {
        deleted_at: deletedAt,
        recycle_expires_at: expiresAt
      }
    }
  );
}

async function restoreCloudNotesByIds(ids, session) {
  if (!ids.length || !session?.access_token || !isSupabaseConfigured()) return;
  const userId = encodeURIComponent(session.user.id);
  await Promise.all(ids.map((id) =>
    supabaseRequest(`/rest/v1/notes?id=eq.${encodeURIComponent(id)}&user_id=eq.${userId}`, {
      method: "PATCH",
      token: session.access_token,
      body: {
        deleted_at: null,
        recycle_expires_at: null
      }
    })
  ));
}

async function hardDeleteCloudNotesByIds(ids, session) {
  if (!ids.length || !session?.access_token || !isSupabaseConfigured()) return;
  const userId = encodeURIComponent(session.user.id);
  await Promise.all(ids.map((id) =>
    supabaseRequest(`/rest/v1/notes?id=eq.${encodeURIComponent(id)}&user_id=eq.${userId}`, {
      method: "DELETE",
      token: session.access_token
    })
  ));
}

function normalizeRecycleNote(note) {
  return {
    id: note.id || crypto.randomUUID(),
    text: note.text || "",
    url: note.url || "",
    title: note.title || "",
    tags: normalizeTags(note.tags),
    domain: note.domain || extractDomain(note.url || ""),
    created_at: note.created_at || new Date().toISOString(),
    source: note.source || "local"
  };
}

async function getRecycleBinNotes() {
  const notes = await getStorage(STORAGE_KEYS.RECYCLE_BIN);
  const now = Date.now();
  const filtered = (Array.isArray(notes) ? notes : []).filter((item) => {
    const deletedTs = new Date(item.deleted_at || 0).getTime();
    return Number.isFinite(deletedTs) && now - deletedTs <= RECYCLE_RETENTION_MS;
  });
  if ((Array.isArray(notes) ? notes.length : 0) !== filtered.length) {
    await setStorage({ [STORAGE_KEYS.RECYCLE_BIN]: filtered });
  }
  return filtered.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
}

async function saveRecycleBinNotes(notes) {
  await setStorage({ [STORAGE_KEYS.RECYCLE_BIN]: notes });
}

async function moveNoteToRecycleBin(note) {
  const normalized = normalizeRecycleNote(note);
  const bin = await getRecycleBinNotes();
  const fingerprint = makeNoteFingerprint(normalized);
  const deduped = bin.filter((item) => makeNoteFingerprint(item.note || {}) !== fingerprint);
  deduped.unshift({
    bin_id: `local:${crypto.randomUUID()}`,
    note: normalized,
    deleted_at: new Date().toISOString()
  });
  await saveRecycleBinNotes(deduped);
}

async function restoreRecycleBinNotes(binIds = []) {
  const idSet = new Set(binIds);
  const bin = await getRecycleBinNotes();
  const toRestore = bin.filter((item) => idSet.has(item.bin_id));
  const remaining = bin.filter((item) => !idSet.has(item.bin_id));

  for (const item of toRestore) {
    const note = item.note || {};
    const localNote = await saveLocalNote({
      text: note.text,
      url: note.url,
      title: note.title,
      createdAt: note.created_at,
      tags: note.tags
    });
    await syncNoteToCloud(localNote).catch(() => null);
  }

  await saveRecycleBinNotes(remaining);
}

async function fetchCloudNotes() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const session = await getValidAuthSession();
  if (!session?.access_token || !session?.user?.id) {
    return [];
  }

  const queryWithTags = `/rest/v1/notes?select=id,user_id,text,url,created_at,tags&user_id=eq.${session.user.id}&deleted_at=is.null&order=created_at.desc`;
  const queryWithoutTags = `/rest/v1/notes?select=id,user_id,text,url,created_at&user_id=eq.${session.user.id}&deleted_at=is.null&order=created_at.desc`;

  let rows = [];
  try {
    rows = await supabaseRequest(queryWithTags, {
      method: "GET",
      token: session.access_token
    });
  } catch (error) {
    if (String(error?.message || "").includes("column") && String(error?.message || "").includes("tags")) {
      rows = await supabaseRequest(queryWithoutTags, {
        method: "GET",
        token: session.access_token
      });
    } else if (isJwtExpiredError(error)) {
      await logout();
      return [];
    } else {
      throw error;
    }
  }

  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    url: row.url,
    title: "",
    tags: normalizeTags(row.tags),
    domain: extractDomain(row.url),
    created_at: row.created_at,
    source: "cloud"
  }));
}

async function fetchCloudRecycledNotes() {
  if (!isSupabaseConfigured()) return [];
  const session = await getValidAuthSession();
  if (!session?.access_token || !session?.user?.id) return [];

  const queryWithTags = `/rest/v1/notes?select=id,user_id,text,url,created_at,tags,deleted_at,recycle_expires_at&user_id=eq.${session.user.id}&deleted_at=not.is.null&recycle_expires_at=gt.now()&order=deleted_at.desc`;
  const queryWithoutTags = `/rest/v1/notes?select=id,user_id,text,url,created_at,deleted_at,recycle_expires_at&user_id=eq.${session.user.id}&deleted_at=not.is.null&recycle_expires_at=gt.now()&order=deleted_at.desc`;

  let rows = [];
  try {
    rows = await supabaseRequest(queryWithTags, {
      method: "GET",
      token: session.access_token
    });
  } catch (error) {
    if (String(error?.message || "").includes("column") && String(error?.message || "").includes("tags")) {
      rows = await supabaseRequest(queryWithoutTags, {
        method: "GET",
        token: session.access_token
      });
    } else if (isJwtExpiredError(error)) {
      await logout();
      return [];
    } else {
      throw error;
    }
  }

  return rows.map((row) => ({
    bin_id: `cloud:${row.id}`,
    deleted_at: row.deleted_at,
    note: {
      id: row.id,
      text: row.text,
      url: row.url,
      title: "",
      tags: normalizeTags(row.tags),
      domain: extractDomain(row.url),
      created_at: row.created_at,
      source: "cloud"
    }
  }));
}

async function beginGoogleLogin() {
  if (!isSupabaseConfigured()) {
    throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY in background.js first.");
  }

  const redirectUri = chrome.identity.getRedirectURL();
  const codeVerifier = randomString(96);
  const codeChallenge = await makeCodeChallenge(codeVerifier);
  const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "s256");
  authUrl.searchParams.set("scopes", "email profile");

  const runWebAuthFlow = () =>
    new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true
        },
        (redirectedTo) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(redirectedTo);
        }
      );
    });

  const callbackUrl = await runWebAuthFlow().catch((error) => {
    if (isUserCancelledLogin(error)) {
      throw new Error("Login failed: Approve login to sync and access your notes across devices.");
    }
    throw new Error(
      `${error.message}. Make sure this exact redirect URL is added in Supabase Auth settings: ${redirectUri}`
    );
  });

  if (!callbackUrl) {
    throw new Error("Login failed: no callback URL.");
  }

  const queryParams = new URLSearchParams((callbackUrl.split("?")[1] || "").trim());
  const authCode = queryParams.get("code");

  if (!authCode) {
    throw new Error(
      `Login failed: auth code missing. Callback URL was: ${callbackUrl}`
    );
  }

  const tokenResponse = await supabaseRequest("/auth/v1/token?grant_type=pkce", {
    method: "POST",
    body: {
      auth_code: authCode,
      code_verifier: codeVerifier
    }
  });

  if (!tokenResponse?.access_token) {
    throw new Error("Login failed: no access token from Supabase PKCE exchange.");
  }

  const session = await buildAndStoreSession(tokenResponse);
  await syncUnsyncedLocalNotes();
  return session;
}

async function logout() {
  await setStorage({ [STORAGE_KEYS.AUTH]: null });
  await syncStoredPlan(null);
  validatedSessionCache = { token: null, validatedAt: 0 };
}

async function getCombinedNotes() {
  const local = (await getStorage(STORAGE_KEYS.NOTES)) || [];
  const cloud = await fetchCloudNotes();
  const cloudRecycled = await fetchCloudRecycledNotes();

  const localByFingerprint = new Map(local.map((note) => [makeNoteFingerprint(note), note]));
  const normalizedCloud = cloud.map((note) => {
    const match = localByFingerprint.get(makeNoteFingerprint(note));
    if ((!note.tags || !note.tags.length) && match?.tags?.length) {
      return { ...note, tags: match.tags };
    }
    return note;
  });

  const cloudFingerprints = new Set(normalizedCloud.map(makeNoteFingerprint));
  const recycledFingerprints = new Set(cloudRecycled.map((item) => makeNoteFingerprint(item.note)));
  const localFiltered = local.filter((note) => {
    if (!note.synced_cloud) {
      return true;
    }
    const fp = makeNoteFingerprint(note);
    return !cloudFingerprints.has(fp) && !recycledFingerprints.has(fp);
  });

  const merged = [...normalizedCloud, ...localFiltered];
  merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  await syncCustomTagsFromNotes(merged);

  return merged;
}

async function getCurrentPlan() {
  const session = await getValidAuthSession();
  return getEffectivePlan(session);
}

function buildHighlightedSourceUrl(noteLike) {
  const rawUrl = String(noteLike?.url || "").trim();
  const snippet = String(noteLike?.text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

  if (!rawUrl || !snippet) {
    return rawUrl;
  }

  try {
    const url = new URL(rawUrl);
    const base = `${url.origin}${url.pathname}${url.search}`;
    return `${base}${url.hash || ""}`;
  } catch {
    return rawUrl;
  }
}

async function storePendingHighlight(noteLike) {
  await setStorage({
    pendingHighlight: {
      url: String(noteLike?.url || "").trim(),
      text: String(noteLike?.text || "").replace(/\s+/g, " ").trim(),
      createdAt: Date.now()
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureLicenseRecheckAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  ensureLicenseRecheckAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== LICENSE_RECHECK_ALARM) return;

  revalidateStoredLicense().catch(() => null);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "SAVE_NOTE": {
        const plan = await getCurrentPlan();
        const noteText = String(message.payload?.text || "");
        if (noteText.length > plan.maxNoteCharacters) {
          sendResponse({
            ok: false,
            error: `Note length ${noteText.length}/${plan.maxNoteCharacters} exceeds the allowed limit.`
          });
          break;
        }

        const existingNotes = await getCombinedNotes();
        if (existingNotes.length >= plan.maxNotes) {
          sendResponse({
            ok: false,
            error: `Note limit reached (${plan.maxNotes}/${plan.maxNotes}). Delete notes to save more.`
          });
          break;
        }

        const localNote = await saveLocalNote(message.payload);
        let cloudSynced = false;
        let cloudError = null;
        try {
          cloudSynced = await syncNoteToCloud(localNote);
        } catch (error) {
          cloudError = error.message;
        }
        sendResponse({ ok: true, note: localNote, cloudSynced, cloudError });
        break;
      }
      case "GET_NOTES": {
        const notes = await getCombinedNotes();
        sendResponse({ ok: true, notes });
        break;
      }
      case "DELETE_NOTE": {
        const { id, source, text, url, created_at } = message.payload || {};
        const session = await getValidAuthSession();
        const hasFingerprintFields = text && url && created_at;
        const fingerprint = hasFingerprintFields
          ? makeNoteFingerprint({ text, url, created_at })
          : null;

        if (fingerprint) {
          await deleteLocalNotesByFingerprint(fingerprint);
          await deleteCloudNotesByFingerprint({ text, url, created_at }, session);
        } else if (source === "cloud") {
          if (session?.access_token && isSupabaseConfigured()) {
            await supabaseRequest(`/rest/v1/notes?id=eq.${encodeURIComponent(id)}`, {
              method: "DELETE",
              token: session.access_token
            });
          }
        } else {
          const notes = (await getStorage(STORAGE_KEYS.NOTES)) || [];
          const filtered = notes.filter((note) => note.id !== id);
          await setStorage({ [STORAGE_KEYS.NOTES]: filtered });
        }

        sendResponse({ ok: true });
        break;
      }
      case "MOVE_NOTE_TO_BIN": {
        const note = message.payload?.note;
        if (!note) {
          sendResponse({ ok: false, error: "Missing note payload." });
          break;
        }
        const { text, url, created_at } = note;
        const session = await getValidAuthSession();
        const hasFingerprintFields = text && url && created_at;
        const fingerprint = hasFingerprintFields
          ? makeNoteFingerprint({ text, url, created_at })
          : null;

        if (fingerprint) {
          await deleteLocalNotesByFingerprint(fingerprint);
        }

        if (session?.access_token && session?.user?.id) {
          await softDeleteCloudNote(note, session);
        } else {
          await moveNoteToRecycleBin(note);
        }

        sendResponse({ ok: true });
        break;
      }
      case "GET_RECYCLE_BIN": {
        const localBin = await getRecycleBinNotes();
        const cloudBin = await fetchCloudRecycledNotes();
        const notes = [...cloudBin, ...localBin].sort(
          (a, b) => new Date(b.deleted_at) - new Date(a.deleted_at)
        );
        sendResponse({ ok: true, notes });
        break;
      }
      case "RESTORE_BIN_NOTES": {
        const binIds = message.payload?.binIds || [];
        const cloudIds = binIds
          .filter((id) => String(id).startsWith("cloud:"))
          .map((id) => String(id).slice("cloud:".length));
        const localIds = binIds.filter((id) => !String(id).startsWith("cloud:"));
        const session = await getValidAuthSession();
        await restoreRecycleBinNotes(localIds);
        await restoreCloudNotesByIds(cloudIds, session);
        sendResponse({ ok: true });
        break;
      }
      case "DELETE_BIN_NOTES": {
        const binIds = message.payload?.binIds || [];
        const cloudIds = binIds
          .filter((id) => String(id).startsWith("cloud:"))
          .map((id) => String(id).slice("cloud:".length));
        const localIdSet = new Set(binIds.filter((id) => !String(id).startsWith("cloud:")));
        const bin = await getRecycleBinNotes();
        await saveRecycleBinNotes(bin.filter((item) => !localIdSet.has(item.bin_id)));
        const session = await getValidAuthSession();
        await hardDeleteCloudNotesByIds(cloudIds, session);
        sendResponse({ ok: true });
        break;
      }
      case "EMPTY_BIN": {
        await saveRecycleBinNotes([]);
        const cloudBin = await fetchCloudRecycledNotes();
        const cloudIds = cloudBin.map((item) => String(item.bin_id).slice("cloud:".length));
        const session = await getValidAuthSession();
        await hardDeleteCloudNotesByIds(cloudIds, session);
        sendResponse({ ok: true });
        break;
      }
      case "LOGIN_GOOGLE": {
        const session = await beginGoogleLogin();
        const plan = await syncStoredPlan(session);
        await enforceFreePlanOverflowPolicy(session);
        sendResponse({ ok: true, session, plan });
        break;
      }
      case "LOGOUT": {
        await logout();
        sendResponse({ ok: true });
        break;
      }
      case "GET_AUTH": {
        const session = await getValidAuthSession();
        let licenseState = await getStoredLicenseState(session);
        if (licenseState?.activated && licenseState?.licenseKey) {
          const revalidated = await revalidateStoredLicense().catch(() => null);
          if (revalidated?.licenseState) {
            licenseState = revalidated.licenseState;
          } else if (revalidated?.downgraded) {
            licenseState = null;
          }
        }
        const plan = await syncStoredPlan(session);
        await enforceFreePlanOverflowPolicy(session);
        sendResponse({ ok: true, session, plan, licenseState });
        break;
      }
      case "GET_LICENSE_STATE": {
        const session = await getValidAuthSession();
        const licenseState = await getStoredLicenseState(session);
        sendResponse({ ok: true, licenseState });
        break;
      }
      case "GET_PLAN": {
        const plan = await getCurrentPlan();
        await setStorage({ [STORAGE_KEYS.PLAN]: plan });
        sendResponse({ ok: true, plan });
        break;
      }
      case "VERIFY_LICENSE": {
        const licenseKey = String(message.payload?.licenseKey || "").trim();
        if (!licenseKey) {
          sendResponse({ ok: false, error: "License key is required." });
          break;
        }

        const result = await activateProLicense(licenseKey);
        sendResponse({ ok: true, ...result });
        break;
      }
      case "CLEAR_LICENSE": {
        await clearStoredLicenseState();
        const session = await getValidAuthSession();
        if (session?.access_token && session?.user?.id) {
          const subscription = await fetchUserSubscription(session);
          await upsertUserSubscription(session, {
            plan: "free",
            licenseKey: subscription?.license_key || null,
            downgradedAt: new Date().toISOString()
          });
        }
        const plan = await syncStoredPlan(session);
        sendResponse({ ok: true, plan });
        break;
      }
      case "RECHECK_LICENSE": {
        const result = await revalidateStoredLicense();
        sendResponse({ ok: true, ...result });
        break;
      }
      case "OPEN_NOTE_SOURCE": {
        const note = message.payload?.note || {};
        const targetUrl = buildHighlightedSourceUrl(note);
        if (!targetUrl) {
          sendResponse({ ok: false, error: "Missing source URL." });
          break;
        }

        await storePendingHighlight(note);
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
          await chrome.tabs.update(activeTab.id, { url: targetUrl, active: true });
        } else {
          await chrome.tabs.create({ url: targetUrl, active: true });
        }
        sendResponse({ ok: true });
        break;
      }
      case "SYNC_NOW": {
        const result = await runStartupSync();
        sendResponse({ ok: true, ...result });
        break;
      }
      case "SET_SESSION_FROM_TOKEN": {
        const session = await buildAndStoreSession({
          access_token: message.payload?.accessToken,
          refresh_token: message.payload?.refreshToken,
          expires_at: message.payload?.expiresAt
        });
        await syncUnsyncedLocalNotes();
        sendResponse({ ok: true, session });
        break;
      }
      case "REMOVE_TAG_FROM_NOTES": {
        await removeTagFromLocalNotes(message.payload?.tag);
        sendResponse({ ok: true });
        break;
      }
      case "DELETE_NOTES_BY_TAG": {
        const tag = message.payload?.tag;
        await deleteLocalNotesByTag(tag);

        const cloudNotes = await fetchCloudNotes();
        const taggedCloud = cloudNotes.filter((note) => (note.tags || []).includes(tag));
        const session = await getAuthSession();
        if (session?.access_token && isSupabaseConfigured()) {
          for (const note of taggedCloud) {
            await supabaseRequest(`/rest/v1/notes?id=eq.${encodeURIComponent(note.id)}`, {
              method: "DELETE",
              token: session.access_token
            });
          }
        }

        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: "Unsupported message type." });
    }
  })().catch((error) => {
    sendResponse({ ok: false, error: error.message || "Unknown error." });
  });

  return true;
});
