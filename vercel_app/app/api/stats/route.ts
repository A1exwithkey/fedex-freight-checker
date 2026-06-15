import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type EventType = "visit" | "quote";

type StatsPayload = {
  type?: EventType;
  visitorId?: string;
  status?: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function supabaseReady() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(extra?: HeadersInit): HeadersInit {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY ?? "",
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
    "content-type": "application/json",
    ...extra
  };
}

function parseCount(contentRange: string | null): number {
  if (!contentRange) {
    return 0;
  }
  const total = contentRange.split("/").at(-1);
  return total && total !== "*" ? Number(total) : 0;
}

async function countRows(path: string): Promise<number> {
  if (!SUPABASE_URL) {
    return 0;
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "GET",
    headers: supabaseHeaders({
      prefer: "count=exact",
      range: "0-0"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase count failed: HTTP ${response.status}`);
  }

  return parseCount(response.headers.get("content-range"));
}

async function readStats() {
  const [visitors, visits, quotes] = await Promise.all([
    countRows("usage_visitors?select=id"),
    countRows("usage_events?select=id&event_type=eq.visit"),
    countRows("usage_events?select=id&event_type=eq.quote")
  ]);

  return {
    status: "OK",
    visitors,
    visits,
    quotes
  };
}

export async function GET() {
  if (!supabaseReady()) {
    return NextResponse.json({
      status: "Not Configured",
      visitors: null,
      visits: null,
      quotes: null
    });
  }

  try {
    return NextResponse.json(await readStats());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown stats error";
    return NextResponse.json({ status: "Need Review", error: message }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!supabaseReady()) {
    return NextResponse.json({ status: "Not Configured" }, { status: 202 });
  }

  try {
    const payload = (await request.json()) as StatsPayload;
    if (payload.type !== "visit" && payload.type !== "quote") {
      return NextResponse.json({ status: "Need Review", error: "Invalid stats event type" }, { status: 400 });
    }

    const visitorId = typeof payload.visitorId === "string" ? payload.visitorId.slice(0, 80) : null;
    const userAgent = request.headers.get("user-agent")?.slice(0, 240) ?? null;

    if (payload.type === "visit" && visitorId) {
      const visitorResponse = await fetch(`${SUPABASE_URL}/rest/v1/usage_visitors`, {
        method: "POST",
        headers: supabaseHeaders({
          prefer: "resolution=merge-duplicates"
        }),
        body: JSON.stringify({
          id: visitorId,
          last_seen_at: new Date().toISOString()
        })
      });

      if (!visitorResponse.ok) {
        throw new Error(`Supabase visitor upsert failed: HTTP ${visitorResponse.status}`);
      }
    }

    const eventResponse = await fetch(`${SUPABASE_URL}/rest/v1/usage_events`, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify({
        event_type: payload.type,
        visitor_id: visitorId,
        status: payload.status === "OK" ? "OK" : payload.status === "Need Review" ? "Need Review" : null,
        path: "/",
        user_agent: userAgent
      })
    });

    if (!eventResponse.ok) {
      throw new Error(`Supabase event insert failed: HTTP ${eventResponse.status}`);
    }

    return NextResponse.json(await readStats());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown stats error";
    return NextResponse.json({ status: "Need Review", error: message }, { status: 502 });
  }
}
