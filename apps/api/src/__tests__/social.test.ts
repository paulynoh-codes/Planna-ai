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

async function generatePublic(
  app: ReturnType<typeof createApp>,
  token: string,
  destination = "Kyoto",
) {
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
  const id = gen.body.itinerary.id as string;
  await request(app)
    .patch(`/api/itineraries/${id}`)
    .set("authorization", `Bearer ${token}`)
    .send({ visibility: "public" });
  return id;
}

describe("feed", () => {
  it("returns public itineraries, excludes private ones", async () => {
    const app = createApp();
    const author = await signup(app, { username: "author1" });
    const publicId = await generatePublic(app, author.token, "Seoul");

    // A private itinerary that should not surface
    await request(app)
      .post("/api/itinerary/generate")
      .set("authorization", `Bearer ${author.token}`)
      .send({
        destination: "Hidden",
        durationDays: 2,
        budgetTier: "mid",
        tripType: "solo",
        vibeTags: ["food"],
      });

    const res = await request(app).get("/api/feed");
    expect(res.status).toBe(200);
    const ids = res.body.recent.map((i: { id: string }) => i.id);
    expect(ids).toContain(publicId);
    expect(res.body.recent.every((i: { visibility: string }) => i.visibility === "public")).toBe(true);
  });
});

describe("like / save toggle", () => {
  it("toggles like on and off, updating count", async () => {
    const app = createApp();
    const author = await signup(app, { username: "creator" });
    const id = await generatePublic(app, author.token);

    const reader = await signup(app, { username: "reader" });

    const on = await request(app)
      .post(`/api/itineraries/${id}/like`)
      .set("authorization", `Bearer ${reader.token}`);
    expect(on.status).toBe(200);
    expect(on.body.active).toBe(true);
    expect(on.body.count).toBe(1);

    const off = await request(app)
      .post(`/api/itineraries/${id}/like`)
      .set("authorization", `Bearer ${reader.token}`);
    expect(off.body.active).toBe(false);
    expect(off.body.count).toBe(0);
  });

  it("save appears in /api/saves", async () => {
    const app = createApp();
    const author = await signup(app, { username: "c2" });
    const id = await generatePublic(app, author.token, "Porto");
    const reader = await signup(app, { username: "r2" });

    await request(app)
      .post(`/api/itineraries/${id}/save`)
      .set("authorization", `Bearer ${reader.token}`);

    const saves = await request(app)
      .get("/api/saves")
      .set("authorization", `Bearer ${reader.token}`);
    expect(saves.status).toBe(200);
    expect(saves.body.itineraries).toHaveLength(1);
    expect(saves.body.itineraries[0].id).toBe(id);
  });
});

describe("comments", () => {
  it("posts, lists, and deletes a comment", async () => {
    const app = createApp();
    const author = await signup(app, { username: "c3" });
    const id = await generatePublic(app, author.token);
    const reader = await signup(app, { username: "r3" });

    const post = await request(app)
      .post(`/api/itineraries/${id}/comments`)
      .set("authorization", `Bearer ${reader.token}`)
      .send({ text: "Looks great!" });
    expect(post.status).toBe(201);
    expect(post.body.comment.text).toBe("Looks great!");
    expect(post.body.comment.username).toBe("r3");

    const list = await request(app).get(`/api/itineraries/${id}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.comments).toHaveLength(1);

    const del = await request(app)
      .delete(`/api/itineraries/comments/${post.body.comment.id}`)
      .set("authorization", `Bearer ${reader.token}`);
    expect(del.status).toBe(204);

    const after = await request(app).get(`/api/itineraries/${id}/comments`);
    expect(after.body.comments).toHaveLength(0);
  });

  it("lets itinerary owner moderate others' comments", async () => {
    const app = createApp();
    const author = await signup(app, { username: "ownermod" });
    const id = await generatePublic(app, author.token);
    const reader = await signup(app, { username: "readermod" });

    const post = await request(app)
      .post(`/api/itineraries/${id}/comments`)
      .set("authorization", `Bearer ${reader.token}`)
      .send({ text: "spam" });

    const del = await request(app)
      .delete(`/api/itineraries/comments/${post.body.comment.id}`)
      .set("authorization", `Bearer ${author.token}`);
    expect(del.status).toBe(204);
  });

  it("rejects empty comments", async () => {
    const app = createApp();
    const author = await signup(app, { username: "emptycmt" });
    const id = await generatePublic(app, author.token);

    const res = await request(app)
      .post(`/api/itineraries/${id}/comments`)
      .set("authorization", `Bearer ${author.token}`)
      .send({ text: "" });
    expect(res.status).toBe(400);
  });
});

describe("profile", () => {
  it("returns public itineraries only for a user", async () => {
    const app = createApp();
    const author = await signup(app, { username: "alice", displayName: "Alice" });
    const publicId = await generatePublic(app, author.token, "Bali");
    // Also generate a private one
    await request(app)
      .post("/api/itinerary/generate")
      .set("authorization", `Bearer ${author.token}`)
      .send({
        destination: "PrivateTown",
        durationDays: 2,
        budgetTier: "mid",
        tripType: "solo",
        vibeTags: ["food"],
      });

    const res = await request(app).get("/api/users/alice");
    expect(res.status).toBe(200);
    expect(res.body.profile.username).toBe("alice");
    expect(res.body.profile.publishedCount).toBe(1);
    expect(res.body.itineraries).toHaveLength(1);
    expect(res.body.itineraries[0].id).toBe(publicId);
  });

  it("returns 404 for unknown user", async () => {
    const app = createApp();
    const res = await request(app).get("/api/users/ghost");
    expect(res.status).toBe(404);
  });
});
