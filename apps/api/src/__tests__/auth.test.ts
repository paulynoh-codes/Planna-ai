import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { v4 as uuid } from "uuid";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
process.env.MONGODB_URI = "mongodb://localhost:27017/planna-test";
process.env.CLIENT_ORIGIN = "*";

const { createApp } = await import("../app.js");
const { startTestDb, stopTestDb, clearTestDb } = await import("./setup.js");
const { setAiClient, resetAiClient } = await import("../services/ai.js");
const { ItineraryModel } = await import("../models/Itinerary.js");

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
              itemId: uuid(),
              category: "food",
              name: "Mock breakfast",
              area: input.destination,
              description: "",
              timeSlot: "morning",
              sourceType: "generated",
            },
          ],
        })),
      };
    },
    async generateSwapSuggestions() {
      throw new Error("generateSwapSuggestions not mocked in this suite");
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

describe("auth + anonymous draft claim", () => {
  it("signs up a user and claims anonymous drafts", async () => {
    const app = createApp();
    const anonSession = uuid();

    const genRes = await request(app)
      .post("/api/itinerary/generate")
      .set("x-anon-session", anonSession)
      .send({
        destination: "Tokyo",
        durationDays: 3,
        budgetTier: "mid",
        tripType: "couple",
        vibeTags: ["food", "culture"],
      });
    expect(genRes.status).toBe(201);
    expect(genRes.body.itinerary.ownerId).toBeNull();

    const signupRes = await request(app).post("/api/auth/signup").send({
      email: "traveler@example.com",
      password: "hunter22hunter",
      username: "traveler",
      anonymousSessionId: anonSession,
    });
    expect(signupRes.status).toBe(201);
    const token = signupRes.body.tokens.accessToken;
    expect(typeof token).toBe("string");

    const libRes = await request(app)
      .get("/api/itineraries")
      .set("authorization", `Bearer ${token}`);
    expect(libRes.status).toBe(200);
    expect(libRes.body.itineraries).toHaveLength(1);
    expect(libRes.body.itineraries[0].ownerId).toBe(signupRes.body.user.id);

    const claimed = await ItineraryModel.findOne({ anonymousSessionId: anonSession });
    expect(claimed).toBeNull();
  });

  it("rejects duplicate emails", async () => {
    const app = createApp();
    await request(app).post("/api/auth/signup").send({
      email: "dup@example.com",
      password: "hunter22hunter",
      username: "dupuser",
    });
    const res = await request(app).post("/api/auth/signup").send({
      email: "dup@example.com",
      password: "hunter22hunter",
      username: "dupuser2",
    });
    expect(res.status).toBe(409);
  });

  it("logs in with valid credentials and rejects bad ones", async () => {
    const app = createApp();
    await request(app).post("/api/auth/signup").send({
      email: "login@example.com",
      password: "hunter22hunter",
      username: "loginuser",
    });
    const good = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "hunter22hunter" });
    expect(good.status).toBe(200);

    const bad = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "wrongpassword" });
    expect(bad.status).toBe(401);
  });
});
