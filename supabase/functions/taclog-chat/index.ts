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

const BRIEFING_PROMPT = `You are TACLOG AI generating a formal logistics estimate briefing. Analyze the battlefield context provided and produce a comprehensive logistics assessment.

Be specific with numbers. Use the actual data provided — don't make up figures. Base all calculations on the equipment counts, fuel states, and distances in the context.

For Class I (Rations): Calculate as personnel × (mission_hours / 8) × 3 meals.
For Class III (Fuel): Use the actual fuel totals from context. Each HEMTT tanker carries 2,500 gallons.
For Class V (Ammunition): Estimate basic load based on vehicle types (e.g., Abrams carries 42 main gun rounds, Bradley carries 900 25mm rounds, etc.)

Identify genuine risks based on actual fuel percentages and distances.`;

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

    const { messages, context, mode } = await req.json();

    // BRIEFING MODE — structured JSON output via tool calling
    if (mode === "briefing") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: BRIEFING_PROMPT,
          messages: [
            {
              role: "user",
              content: `[BATTLEFIELD CONTEXT]\n${context}\n[END CONTEXT]\n\nGenerate a complete logistics estimate briefing for this battlefield situation.`,
            },
          ],
          tools: [
            {
              name: "generate_briefing",
              description: "Generate a structured logistics estimate briefing with all required sections.",
              input_schema: {
                type: "object",
                properties: {
                  missionSummary: {
                    type: "string",
                    description: "One paragraph describing the operational picture, force disposition, and mission scope.",
                  },
                  forceComposition: {
                    type: "object",
                    properties: {
                      totalVehicles: { type: "number" },
                      totalPersonnel: { type: "number" },
                      byCategory: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            category: { type: "string" },
                            count: { type: "number" },
                            types: { type: "string" },
                          },
                          required: ["category", "count", "types"],
                        },
                      },
                    },
                    required: ["totalVehicles", "totalPersonnel", "byCategory"],
                  },
                  supplyRequirements: {
                    type: "object",
                    properties: {
                      classIII: {
                        type: "object",
                        properties: {
                          totalGallons: { type: "number" },
                          hemttLoads: { type: "number" },
                          resupplySchedule: { type: "string" },
                          status: { type: "string", enum: ["green", "amber", "red"] },
                        },
                        required: ["totalGallons", "hemttLoads", "resupplySchedule", "status"],
                      },
                      classI: {
                        type: "object",
                        properties: {
                          totalMeals: { type: "number" },
                          personnelCount: { type: "number" },
                          mealBreakdown: { type: "string" },
                          status: { type: "string", enum: ["green", "amber", "red"] },
                        },
                        required: ["totalMeals", "personnelCount", "mealBreakdown", "status"],
                      },
                      classV: {
                        type: "object",
                        properties: {
                          assessment: { type: "string" },
                          details: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                platform: { type: "string" },
                                basicLoad: { type: "string" },
                              },
                              required: ["platform", "basicLoad"],
                            },
                          },
                          status: { type: "string", enum: ["green", "amber", "red"] },
                        },
                        required: ["assessment", "details", "status"],
                      },
                    },
                    required: ["classIII", "classI", "classV"],
                  },
                  criticalRisks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        risk: { type: "string" },
                        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        mitigation: { type: "string" },
                      },
                      required: ["risk", "severity", "mitigation"],
                    },
                  },
                  movementAnalysis: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        route: { type: "string" },
                        distance: { type: "string" },
                        estimatedTime: { type: "string" },
                        fuelCost: { type: "string" },
                      },
                      required: ["route", "distance", "estimatedTime", "fuelCost"],
                    },
                  },
                  recommendation: {
                    type: "string",
                    description: "Overall AI assessment and suggested actions — 2-3 sentences.",
                  },
                },
                required: [
                  "missionSummary",
                  "forceComposition",
                  "supplyRequirements",
                  "criticalRisks",
                  "movementAnalysis",
                  "recommendation",
                ],
              },
            },
          ],
          tool_choice: { type: "tool", name: "generate_briefing" },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Anthropic API error:", response.status, errorText);
        return new Response(
          JSON.stringify({ error: `API error: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      // Extract tool call result
      const toolUse = data.content?.find((c: any) => c.type === "tool_use");
      if (!toolUse?.input) {
        return new Response(
          JSON.stringify({ error: "Failed to generate briefing structure" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ briefing: toolUse.input }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CHAT MODE — streaming
    const anthropicMessages = messages.map((m: { role: string; text: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text,
    }));

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
