const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const productMap = {
  monthly: Deno.env.get("GUMROAD_PRODUCT_MONTHLY_ID") || "",
  quarterly: Deno.env.get("GUMROAD_PRODUCT_QUARTERLY_ID") || "",
  yearly: Deno.env.get("GUMROAD_PRODUCT_YEARLY_ID") || ""
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

type PlanKey = keyof typeof productMap;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function isExpectedMismatch(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not found") ||
    normalized.includes("invalid") ||
    normalized.includes("license does not exist") ||
    normalized.includes("doesn't exist")
  );
}

async function verifyAgainstProduct(productId: string, licenseKey: string) {
  const body = new URLSearchParams({
    product_id: productId,
    license_key: licenseKey,
    increment_uses_count: "false"
  });

  const response = await fetch("https://api.gumroad.com/v2/licenses/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : `Gumroad verification failed (${response.status}).`
    );
  }

  return data;
}

function isActivePurchase(purchase: Record<string, unknown> | null | undefined) {
  if (!purchase) return false;

  const refunded = Boolean(purchase.refunded);
  const disputed = Boolean(purchase.disputed);
  const chargebacked = Boolean(purchase.chargebacked);
  const disabled = Boolean(purchase.disabled);

  return !refunded && !disputed && !chargebacked && !disabled;
}

async function fetchExistingLicenseOwners(licenseKey: string) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const encodedLicenseKey = encodeURIComponent(licenseKey);
  const baseHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };

  let response = await fetch(
    `${supabaseUrl}/rest/v1/user_subscriptions?select=user_id,plan,license_key,downgraded_at&license_key=eq.${encodedLicenseKey}`,
    {
      method: "GET",
      headers: baseHeaders
    }
  );

  if (!response.ok) {
    const text = await response.text();
    if (!text.includes("downgraded_at")) {
      throw new Error(text || `Subscription lookup failed (${response.status}).`);
    }

    response = await fetch(
      `${supabaseUrl}/rest/v1/user_subscriptions?select=user_id,plan,license_key&license_key=eq.${encodedLicenseKey}`,
      {
        method: "GET",
        headers: baseHeaders
      }
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Subscription lookup failed (${response.status}).`);
  }

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const missingProducts = Object.entries(productMap)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingProducts.length) {
    return jsonResponse(
      { error: `Missing Gumroad product IDs for: ${missingProducts.join(", ")}.` },
      500
    );
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const licenseKey = String(payload?.licenseKey || payload?.license_key || "").trim();
    const userId = String(payload?.userId || payload?.user_id || "").trim();

    if (!licenseKey) {
      return jsonResponse({ error: "License key is required." }, 400);
    }

    if (!userId) {
      return jsonResponse({ error: "User id is required." }, 400);
    }

    for (const [plan, productId] of Object.entries(productMap) as [PlanKey, string][]) {
      try {
        const result = await verifyAgainstProduct(productId, licenseKey);
        const purchase =
          result?.purchase && typeof result.purchase === "object"
            ? result.purchase as Record<string, unknown>
            : null;

        if (result?.success === true && isActivePurchase(purchase)) {
          const existingOwners = await fetchExistingLicenseOwners(licenseKey);
          const ownedByCurrentUser = existingOwners.some((row) => row?.user_id === userId);
          const ownedByAnotherUser = existingOwners.some((row) => row?.user_id && row.user_id !== userId);

          if (!ownedByCurrentUser && ownedByAnotherUser) {
            return jsonResponse({
              success: false,
              valid: false,
              error: "License key is already in use."
            }, 409);
          }

          return jsonResponse({
            success: true,
            valid: true,
            plan,
            productId,
            licenseKey,
            uses: Number(result?.uses || 0),
            maxUses: Number(purchase?.quantity || 0),
            purchaseEmail: String(purchase?.email || ""),
            purchaseFullName: String(purchase?.full_name || ""),
            claimedByUserId: String(
              existingOwners.find((row) => row?.user_id === userId)?.user_id ||
              existingOwners[0]?.user_id ||
              userId
            )
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown verification error.";
        if (!isExpectedMismatch(message)) {
          throw error;
        }
      }
    }

    return jsonResponse({
      success: false,
      valid: false,
      error: "License key not found for any active SnapText Pro plan."
    }, 404);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown verification error." },
      500
    );
  }
});
