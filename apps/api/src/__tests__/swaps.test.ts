import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { v4 as uuid } from "uuid";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
process.env.MONGODB_URI = "mongodb://localhost:27017/planna-test";
process.env.CLIENT_ORIGIN = "*";

const { createApp } = await import("../app.js");
const { startTestDb, stopTestDb, clearTestDb } = await import("./setup.js");
const { setAiClient, resetAiClient } = await import("../services/ai.js");

let lastSwapCtx: unknown = null;

beforeAll(async () => {
  await startTestDb();
  setAiClient({
    async generateItinerary(input) {
      return {
        title: `Mock trip to ${input.destination}`,
        summary: "Mock summary",
        days: Array.from({ length: input.durationDays }, (_, i) => ({
          dayNumber: i + 1,
          title: `Day ${i + 1}`,
          items: [
            {
              itemId: "fixed-item-morning",
              category: "food",
              name: "Original breakfast",
              area: input.destination,
              description: "",
              timeSlot: "morning",
              sourceType: "generated",
            },
            {
              itemId: "fixed-item-evening",
              category: "food",
              name: "Original dinner",
              area: input.destination,
              description: "",
              timeSlot: "evening",
              sourceType: "generated",
            },
          ],
        })),
      };
    },
    async generateSwapSuggestions(ctx) {
      lastSwapCtx = ctx;
      return [
        {
          itemId: uuid(),
          category: "food",
          name: "Alternative A",
          area: "Neighborhood A",
          description: "Swap option A.",
          timeSlot: ctx.current.timeSlot,
          sourceType: "swapped",
        },
        {
          itemId: uuid(),
          category: "activity",
          name: "Alternative B",
          area: "Neighborhood B",
          description: "Swap option B.",
          timeSlot: ctx.current.timeSlot,
          sourceType: "swapped",
        },
        {
          itemId: uuid(),
          category: "sight",
          name: "Alternative C",
          area: "Neighborhood C",
          description: "Swap option C.",
          timeSlot: ctx.current.timeSlot,
          sourceType: "swapped",
        },
      ];
    },
  });
});

afterAll(async () => {
  await stopTestDb();
  resetAiClient();
});

afterEach(async () => {
  await clearTestDb();
  lastSwapCtx = null;
});

async function signup(app: ReturnType<typeof createApp>, overrides: Partial<Record<string, string>> = {}) {
  const email = overrides.email ?? `user-${uuid()}@example.com`;
  const username = overrides.username ?? `user_${uuid().slice(0, 8)}`;
  const res = await request(app).post("/api/auth/signup").send({
    email,
    password: "hunter22hunter",
    username,
    displayName: overrides.displayName,
  });
  return {
    token: res.body.tokens.accessToken as string,
    userId: res.body.user.id as string,
    username: res.body.user.username as string,
  };
}

async function generate(app: ReturnType<typeof createApp>, token: string) {
  const gen = await request(app)
    .post("/api/itinerary/generate")
    .set("authorization", `Bearer ${token}`)
    .send({
      destination: "Kyoto",
      durationDays: 2,
      budgetTier: "mid",
      tripType: "solo",
      vibeTags: ["food"],
    });
  return gen.body.itinerary.id as string;
}

describe("smart swaps", () => {
  it("owner receives 3 suggestions pinned to the same timeSlot with sourceType swapped", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "swap_owner" });
    const id = await generate(app, owner.token);

    const res = await request(app)
      .post(`/api/itineraries/${id}/swap`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({ dayNumber: 1, itemId: "fixed-item-morning" });

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(3);
    for (const s of res.body.suggestions) {
      expect(s.timeSlot).toBe("morning");
      expect(s.sourceType).toBe("swapped");
      expect(typeof s.itemId).toBe("string");
    }
    const ids = new Set(res.body.suggestions.map((s: { itemId: string }) => s.itemId));
    expect(ids.size).toBe(3);
  });

  it("passes same-day neighbors and trip context to the AI client", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "swap_ctx" });
    const id = await generate(app, owner.token);

    await request(app)
      .post(`/api/itineraries/${id}/swap`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({ dayNumber: 1, itemId: "fixed-item-morning" });

    const ctx = lastSwapCtx as {
      destination: string;
      current: { itemId: string };
      sameDayOtherItems: Array<{ name: string }>;
    };
    expect(ctx.destination).toBe("Kyoto");
    expect(ctx.current.itemId).toBe("fixed-item-morning");
    expect(ctx.sameDayOtherItems).toHaveLength(1);
    expect(ctx.sameDayOtherItems[0]!.name).toBe("Original dinner");
  });

  it("non-owner cannot request swaps", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "swap_priv_owner" });
    const other = await signup(app, { username: "swap_other" });
    const id = await generate(app, owner.token);

    const res = await request(app)
      .post(`/api/itineraries/${id}/swap`)
      .set("authorization", `Bearer ${other.token}`)
      .send({ dayNumber: 1, itemId: "fixed-item-morning" });
    expect(res.status).toBe(403);
  });

  it("returns 404 when itemId is not in the day", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "swap_404" });
    const id = await generate(app, owner.token);

    const res = await request(app)
      .post(`/api/itineraries/${id}/swap`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({ dayNumber: 1, itemId: "does-not-exist" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("item_not_found");
  });

  it("returns 404 when the day does not exist", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "swap_no_day" });
    const id = await generate(app, owner.token);

    const res = await request(app)
      .post(`/api/itineraries/${id}/swap`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({ dayNumber: 7, itemId: "fixed-item-morning" });
    expect(res.status).toBe(404);
  });

  it("rejects invalid body", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "swap_bad_body" });
    const id = await generate(app, owner.token);

    const res = await request(app)
      .post(`/api/itineraries/${id}/swap`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({ dayNumber: "one", itemId: "" });
    expect(res.status).toBe(400);
  });

  it("requires auth", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "swap_noauth" });
    const id = await generate(app, owner.token);

    const res = await request(app)
      .post(`/api/itineraries/${id}/swap`)
      .send({ dayNumber: 1, itemId: "fixed-item-morning" });
    expect(res.status).toBe(401);
  });
});
