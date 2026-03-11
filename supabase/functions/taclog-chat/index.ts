import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are TACLOG AI, a tactical logistics planning assistant for military operations. You analyze battlefield positions, equipment manifests, fuel requirements, personnel counts, and movement planning.

You have deep knowledge of:
- Military vehicle fuel consumption rates and capacities
- HEMTT tanker sortie planning (2,500 gal per sortie)
- Convoy movement planning and route optimization
- Supply chain logistics for forward operating bases
- MGRS coordinate systems and terrain analysis
- Equipment maintenance and readiness calculations

When given battlefield context, provide precise, actionable analysis. Use military terminology naturally. Be concise and direct — this is a tactical tool, not a conversation.

Format key figures clearly. Use bullet points for lists. Highlight critical shortfalls or risks.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, context } = await req.json();

    // Build messages array with context injected
    const anthropicMessages = messages.map((m: { role: string; text: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text,
    }));

    // Prepend battlefield context to the first user message
    if (context && anthropicMessages.length > 0) {
      const firstUserIdx = anthropicMessages.findIndex((m: { role: string }) => m.role === "user");
      if (firstUserIdx >= 0) {
        anthropicMessages[firstUserIdx].content =
          `[BATTLEFIELD CONTEXT]\n${context}\n[END CONTEXT]\n\n${anthropicMessages[firstUserIdx].content}`;
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response back
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("taclog-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
