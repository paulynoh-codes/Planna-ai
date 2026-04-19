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

beforeAll(async () => {
  await startTestDb();
  setAiClient({
    async generateItinerary(input) {
      return {
        title: `Mock ${input.destination} trip`,
        summary: "Mock summary",
        days: Array.from({ length: input.durationDays }, (_, i) => ({
          dayNumber: i + 1,
          title: `Day ${i + 1}`,
          items: [
            {
              itemId: uuid(),
              category: "sight",
              name: "Landmark walk",
              area: input.destination,
              description: "",
              timeSlot: "morning",
              sourceType: "generated",
            },
            {
              itemId: uuid(),
              category: "food",
              name: "Dinner",
              area: input.destination,
              description: "",
              timeSlot: "evening",
              sourceType: "generated",
            },
          ],
        })),
      };
    },
  });
});

afterAll(async () => {
  await stopTestDb();
  resetAiClient();
});

afterEach(async () => {
  await clearTestDb();
});

describe("itinerary generation", () => {
  it("generates an anonymous itinerary", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/itinerary/generate")
      .set("x-anon-session", uuid())
      .send({
        destination: "Lisbon",
        durationDays: 4,
        budgetTier: "mid",
        tripType: "solo",
        vibeTags: ["food", "culture"],
      });
    expect(res.status).toBe(201);
    expect(res.body.itinerary.days).toHaveLength(4);
    expect(res.body.itinerary.visibility).toBe("private");
    expect(res.body.itinerary.ownerId).toBeNull();
  });

  it("rejects invalid input", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/itinerary/generate")
      .set("x-anon-session", uuid())
      .send({ destination: "X", durationDays: 99, budgetTier: "mid", tripType: "solo", vibeTags: [] });
    expect(res.status).toBe(400);
  });

  it("rejects missing anon session when unauthenticated", async () => {
    const app = createApp();
    const res = await request(app).post("/api/itinerary/generate").send({
      destination: "Paris",
      durationDays: 3,
      budgetTier: "mid",
      tripType: "couple",
      vibeTags: ["romantic"],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("missing_session");
  });

  it("lets authenticated users generate without anon session", async () => {
    const app = createApp();
    const signup = await request(app).post("/api/auth/signup").send({
      email: "gen@example.com",
      password: "hunter22hunter",
      username: "genuser",
    });
    const token = signup.body.tokens.accessToken;
    const res = await request(app)
      .post("/api/itinerary/generate")
      .set("authorization", `Bearer ${token}`)
      .send({
        destination: "Oaxaca",
        durationDays: 3,
        budgetTier: "mid",
        tripType: "solo",
        vibeTags: ["food"],
      });
    expect(res.status).toBe(201);
    expect(res.body.itinerary.ownerId).toBe(signup.body.user.id);
  });

  it("enforces visibility on detail fetch", async () => {
    const app = createApp();
    const anonSession = uuid();
    const gen = await request(app)
      .post("/api/itinerary/generate")
      .set("x-anon-session", anonSession)
      .send({
        destination: "Rome",
        durationDays: 2,
        budgetTier: "mid",
        tripType: "couple",
        vibeTags: ["food"],
      });
    const id = gen.body.itinerary.id;

    const stranger = await request(app).get(`/api/itineraries/${id}`);
    expect(stranger.status).toBe(404);

    const signup = await request(app).post("/api/auth/signup").send({
      email: "viewer@example.com",
      password: "hunter22hunter",
      username: "viewer",
      anonymousSessionId: anonSession,
    });
    const token = signup.body.tokens.accessToken;

    const owner = await request(app)
      .get(`/api/itineraries/${id}`)
      .set("authorization", `Bearer ${token}`);
    expect(owner.status).toBe(200);

    await request(app)
      .patch(`/api/itineraries/${id}`)
      .set("authorization", `Bearer ${token}`)
      .send({ visibility: "public" });

    const publicFetch = await request(app).get(`/api/itineraries/${id}`);
    expect(publicFetch.status).toBe(200);
  });
});
