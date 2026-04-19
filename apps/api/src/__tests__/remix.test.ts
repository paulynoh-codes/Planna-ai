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
        title: `Mock trip to ${input.destination}`,
        summary: "Mock summary",
        days: Array.from({ length: input.durationDays }, (_, i) => ({
          dayNumber: i + 1,
          title: `Day ${i + 1}`,
          items: [
            {
              itemId: uuid(),
              category: "food",
              name: "Mock item",
              area: input.destination,
              description: "",
              timeSlot: "morning",
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

async function generate(app: ReturnType<typeof createApp>, token: string, destination = "Kyoto") {
  const gen = await request(app)
    .post("/api/itinerary/generate")
    .set("authorization", `Bearer ${token}`)
    .send({
      destination,
      durationDays: 2,
      budgetTier: "mid",
      tripType: "solo",
      vibeTags: ["food"],
    });
  return gen.body.itinerary.id as string;
}

async function publish(app: ReturnType<typeof createApp>, token: string, id: string) {
  await request(app)
    .patch(`/api/itineraries/${id}`)
    .set("authorization", `Bearer ${token}`)
    .send({ visibility: "public" });
}

describe("remix", () => {
  it("remixes a public itinerary into the viewer's library with attribution", async () => {
    const app = createApp();
    const author = await signup(app, { username: "remix_author" });
    const reader = await signup(app, { username: "remix_reader" });
    const id = await generate(app, author.token, "Seoul");
    await publish(app, author.token, id);

    const res = await request(app)
      .post(`/api/itineraries/${id}/remix`)
      .set("authorization", `Bearer ${reader.token}`);
    expect(res.status).toBe(201);
    expect(res.body.itinerary.id).not.toBe(id);
    expect(res.body.itinerary.sourceItineraryId).toBe(id);
    expect(res.body.itinerary.ownerId).toBe(reader.userId);
    expect(res.body.itinerary.visibility).toBe("private");
    expect(res.body.itinerary.destination).toBe("Seoul");
    expect(res.body.itinerary.likeCount).toBe(0);
    expect(res.body.itinerary.saveCount).toBe(0);
    expect(res.body.itinerary.commentCount).toBe(0);
    expect(res.body.itinerary.remixCount).toBe(0);
    expect(res.body.itinerary.remixedFrom).toEqual({
      id,
      title: expect.any(String),
      ownerUsername: "remix_author",
      ownerDisplayName: expect.any(String),
    });

    const source = await request(app)
      .get(`/api/itineraries/${id}`)
      .set("authorization", `Bearer ${author.token}`);
    expect(source.body.itinerary.remixCount).toBe(1);
  });

  it("shows the remix in the viewer's library", async () => {
    const app = createApp();
    const author = await signup(app, { username: "lib_author" });
    const reader = await signup(app, { username: "lib_reader" });
    const id = await generate(app, author.token);
    await publish(app, author.token, id);

    await request(app)
      .post(`/api/itineraries/${id}/remix`)
      .set("authorization", `Bearer ${reader.token}`);

    const lib = await request(app)
      .get("/api/itineraries")
      .set("authorization", `Bearer ${reader.token}`);
    expect(lib.status).toBe(200);
    expect(lib.body.itineraries).toHaveLength(1);
    expect(lib.body.itineraries[0].sourceItineraryId).toBe(id);
    expect(lib.body.itineraries[0].remixedFrom.ownerUsername).toBe("lib_author");
  });

  it("blocks remixing a private itinerary (not owned)", async () => {
    const app = createApp();
    const author = await signup(app, { username: "priv_author" });
    const reader = await signup(app, { username: "priv_reader" });
    const id = await generate(app, author.token);

    const res = await request(app)
      .post(`/api/itineraries/${id}/remix`)
      .set("authorization", `Bearer ${reader.token}`);
    expect(res.status).toBe(404);
  });

  it("allows the owner to remix their own private itinerary", async () => {
    const app = createApp();
    const author = await signup(app, { username: "self_remix" });
    const id = await generate(app, author.token);

    const res = await request(app)
      .post(`/api/itineraries/${id}/remix`)
      .set("authorization", `Bearer ${author.token}`);
    expect(res.status).toBe(201);
    expect(res.body.itinerary.sourceItineraryId).toBe(id);
  });

  it("requires auth", async () => {
    const app = createApp();
    const author = await signup(app, { username: "need_auth" });
    const id = await generate(app, author.token);
    await publish(app, author.token, id);

    const res = await request(app).post(`/api/itineraries/${id}/remix`);
    expect(res.status).toBe(401);
  });

  it("remix survives when the source is deleted (attribution drops)", async () => {
    const app = createApp();
    const author = await signup(app, { username: "ghost_author" });
    const reader = await signup(app, { username: "ghost_reader" });
    const id = await generate(app, author.token);
    await publish(app, author.token, id);

    const remix = await request(app)
      .post(`/api/itineraries/${id}/remix`)
      .set("authorization", `Bearer ${reader.token}`);
    const remixId = remix.body.itinerary.id as string;

    await request(app)
      .delete(`/api/itineraries/${id}`)
      .set("authorization", `Bearer ${author.token}`);

    const fetched = await request(app)
      .get(`/api/itineraries/${remixId}`)
      .set("authorization", `Bearer ${reader.token}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.itinerary.sourceItineraryId).toBe(id);
    expect(fetched.body.itinerary.remixedFrom).toBeNull();
  });

  it("concurrent remixes both increment the source count", async () => {
    const app = createApp();
    const author = await signup(app, { username: "count_author" });
    const r1 = await signup(app, { username: "count_r1" });
    const r2 = await signup(app, { username: "count_r2" });
    const id = await generate(app, author.token);
    await publish(app, author.token, id);

    await Promise.all([
      request(app).post(`/api/itineraries/${id}/remix`).set("authorization", `Bearer ${r1.token}`),
      request(app).post(`/api/itineraries/${id}/remix`).set("authorization", `Bearer ${r2.token}`),
    ]);

    const source = await request(app)
      .get(`/api/itineraries/${id}`)
      .set("authorization", `Bearer ${author.token}`);
    expect(source.body.itinerary.remixCount).toBe(2);
  });
});
