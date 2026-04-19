import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuid } from "uuid";
import type { GenerateItineraryInput } from "@planna/shared";
import type { Itinerary, ItineraryDay } from "@planna/shared";
import { env } from "../env.js";
import { logger } from "../logger.js";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are Planna, an expert travel itinerary generator.

Your job: given a destination, duration, budget tier, trip type, and vibe tags, produce a realistic, balanced, day-by-day itinerary that a traveler could actually use.

Hard rules:
- Output is emitted via the emit_itinerary tool. Never respond in plain text.
- Only use real, well-known places, neighborhoods, and landmarks for the destination. Do NOT invent specific restaurant names or business names you are not confident exist. If unsure, use a category and a real neighborhood (e.g. "A sushi omakase in Ginza") rather than a fabricated business name.
- Never claim reservations, tickets, or pricing. Keep descriptions inspirational but honest.
- Days should feel balanced: a mix of food, activity, and rest. Don't over-stuff.
- Use 3-5 items per day across morning, midday, afternoon, evening, and occasionally night.
- Match budget tier and vibe tags. A "budget" trip should not feature luxury hotels; a "luxury + romantic" couples trip should feel special.
- Keep descriptions tight (1-2 sentences each).
- Keep the title short, evocative, and specific to the destination and vibe.
- Keep the summary to 1-2 sentences, present-tense.
- Never use emojis.

Categories: food, activity, sight, lodging, transport, nightlife, other.
Time slots: morning, midday, afternoon, evening, night.`;

const TOOL_NAME = "emit_itinerary";

const TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string", description: "Short evocative trip title." },
    summary: { type: "string", description: "1-2 sentence summary of the trip vibe and arc." },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dayNumber: { type: "integer", minimum: 1 },
          title: { type: "string", description: "Short label for the day (e.g. 'Old Town Day')." },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  enum: ["food", "activity", "sight", "lodging", "transport", "nightlife", "other"],
                },
                name: { type: "string" },
                area: { type: "string", description: "Neighborhood or district." },
                description: { type: "string" },
                timeSlot: {
                  type: "string",
                  enum: ["morning", "midday", "afternoon", "evening", "night"],
                },
                notes: { type: "string" },
              },
              required: ["category", "name", "area", "description", "timeSlot"],
            },
            minItems: 2,
            maxItems: 6,
          },
        },
        required: ["dayNumber", "title", "items"],
      },
    },
  },
  required: ["title", "summary", "days"],
};

export interface GeneratedItineraryBody {
  title: string;
  summary: string;
  days: ItineraryDay[];
}

type RawItem = {
  category: string;
  name: string;
  area: string;
  description: string;
  timeSlot: string;
  notes?: string;
};

type RawDay = { dayNumber: number; title: string; items: RawItem[] };

export interface AiClient {
  generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItineraryBody>;
}

class AnthropicAiClient implements AiClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItineraryBody> {
    const userMessage = `Generate a ${input.durationDays}-day itinerary for ${input.destination}.
Budget tier: ${input.budgetTier}
Trip type: ${input.tripType}
Vibe tags: ${input.vibeTags.join(", ")}${input.notes ? `\nTraveler notes: ${input.notes}` : ""}

Return exactly ${input.durationDays} days, numbered 1 through ${input.durationDays}.`;

    // cache_control is supported at runtime but missing from v0.32 types; cast to pass.
    const systemBlocks = [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ] as unknown as Anthropic.TextBlockParam[];
    const tools = [
      {
        name: TOOL_NAME,
        description: "Emit the structured itinerary.",
        input_schema: TOOL_SCHEMA,
        cache_control: { type: "ephemeral" },
      },
    ] as unknown as Anthropic.Tool[];

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemBlocks,
      tools,
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: userMessage }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("AI response did not include a tool_use block");
    }
    const raw = toolUse.input as { title: string; summary: string; days: RawDay[] };
    return normalizeGenerated(raw, input.durationDays);
  }
}

class StubAiClient implements AiClient {
  async generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItineraryBody> {
    const days: ItineraryDay[] = Array.from({ length: input.durationDays }, (_, i) => ({
      dayNumber: i + 1,
      title: `Day ${i + 1} in ${input.destination}`,
      items: [
        {
          itemId: uuid(),
          category: "food",
          name: "Local breakfast spot",
          area: input.destination,
          description: "Start with a local breakfast to set the tone.",
          timeSlot: "morning",
          sourceType: "generated",
        },
        {
          itemId: uuid(),
          category: "sight",
          name: "Signature neighborhood walk",
          area: input.destination,
          description: "Explore the area's most iconic streets on foot.",
          timeSlot: "midday",
          sourceType: "generated",
        },
        {
          itemId: uuid(),
          category: "food",
          name: "Dinner with a view",
          area: input.destination,
          description: "Wind down with dinner that matches the vibe.",
          timeSlot: "evening",
          sourceType: "generated",
        },
      ],
    }));
    return {
      title: `${input.durationDays} days in ${input.destination}`,
      summary: `A ${input.vibeTags.join(" and ")} itinerary through ${input.destination}.`,
      days,
    };
  }
}

function normalizeGenerated(
  raw: { title: string; summary: string; days: RawDay[] },
  expectedDays: number,
): GeneratedItineraryBody {
  const days = (raw.days ?? [])
    .slice(0, expectedDays)
    .map((d, idx): ItineraryDay => ({
      dayNumber: d.dayNumber ?? idx + 1,
      title: d.title ?? `Day ${idx + 1}`,
      items: (d.items ?? []).map((it) => ({
        itemId: uuid(),
        category: coerceCategory(it.category),
        name: it.name ?? "Untitled stop",
        area: it.area ?? "",
        description: it.description ?? "",
        timeSlot: coerceTimeSlot(it.timeSlot),
        notes: it.notes,
        sourceType: "generated",
      })),
    }));
  return {
    title: raw.title ?? "Your trip",
    summary: raw.summary ?? "",
    days,
  };
}

function coerceCategory(v: string): ItineraryDay["items"][number]["category"] {
  const allowed = ["food", "activity", "sight", "lodging", "transport", "nightlife", "other"] as const;
  return (allowed as readonly string[]).includes(v)
    ? (v as ItineraryDay["items"][number]["category"])
    : "other";
}

function coerceTimeSlot(v: string): ItineraryDay["items"][number]["timeSlot"] {
  const allowed = ["morning", "midday", "afternoon", "evening", "night"] as const;
  return (allowed as readonly string[]).includes(v)
    ? (v as ItineraryDay["items"][number]["timeSlot"])
    : "midday";
}

let cached: AiClient | null = null;

export function getAiClient(): AiClient {
  if (cached) return cached;
  if (env.ANTHROPIC_API_KEY) {
    cached = new AnthropicAiClient(env.ANTHROPIC_API_KEY);
  } else {
    logger.warn("ANTHROPIC_API_KEY not set — using stub AI client");
    cached = new StubAiClient();
  }
  return cached;
}

export function setAiClient(client: AiClient): void {
  cached = client;
}

export function resetAiClient(): void {
  cached = null;
}

export type { Itinerary };
