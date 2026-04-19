import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { v4 as uuid } from "uuid";
import { INVITE_TOKEN_HEADER } from "@planna/shared";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
process.env.MONGODB_URI = "mongodb://localhost:27017/planna-test";
process.env.CLIENT_ORIGIN = "*";

const { createApp } = await import("../app.js");
const { startTestDb, stopTestDb, clearTestDb } = await import("./setup.js");
const { setAiClient, resetAiClient } = await import("../services/ai.js");
const { InviteModel } = await import("../models/Invite.js");

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

async function generatePrivate(
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
  return gen.body.itinerary.id as string;
}

describe("invites — create and list", () => {
  it("owner creates an invite", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "inv_owner" });
    const id = await generatePrivate(app, owner.token);

    const res = await request(app)
      .post(`/api/itineraries/${id}/invites`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({ label: "beta testers" });

    expect(res.status).toBe(201);
    expect(res.body.invite.itineraryId).toBe(id);
    expect(res.body.invite.label).toBe("beta testers");
    expect(typeof res.body.invite.token).toBe("string");
    expect(res.body.invite.token.length).toBeGreaterThan(10);
    expect(res.body.invite.revokedAt).toBeNull();
  });

  it("non-owner cannot create an invite", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "inv_owner2" });
    const other = await signup(app, { username: "inv_other" });
    const id = await generatePrivate(app, owner.token);

    const res = await request(app)
      .post(`/api/itineraries/${id}/invites`)
      .set("authorization", `Bearer ${other.token}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it("lists only non-revoked invites, newest first", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "inv_list" });
    const id = await generatePrivate(app, owner.token);

    const a = await request(app)
      .post(`/api/itineraries/${id}/invites`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({ label: "first" });
    const b = await request(app)
      .post(`/api/itineraries/${id}/invites`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({ label: "second" });

    await request(app)
      .delete(`/api/itineraries/invites/${a.body.invite.id}`)
      .set("authorization", `Bearer ${owner.token}`);

    const list = await request(app)
      .get(`/api/itineraries/${id}/invites`)
      .set("authorization", `Bearer ${owner.token}`);

    expect(list.status).toBe(200);
    expect(list.body.invites).toHaveLength(1);
    expect(list.body.invites[0].id).toBe(b.body.invite.id);
  });
});

describe("invites — access control", () => {
  it("anon viewer with a valid invite token can read the private itinerary", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "acc_owner" });
    const id = await generatePrivate(app, owner.token);
    const created = await request(app)
      .post(`/api/itineraries/${id}/invites`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({});

    const withToken = await request(app)
      .get(`/api/itineraries/${id}`)
      .set(INVITE_TOKEN_HEADER, created.body.invite.token);
    expect(withToken.status).toBe(200);
    expect(withToken.body.itinerary.id).toBe(id);

    const withoutToken = await request(app)
      .get(`/api/itineraries/${id}`);
    expect(withoutToken.status).toBe(404);
  });

  it("accepts ?invite= query fallback", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "qfallback" });
    const id = await generatePrivate(app, owner.token);
    const created = await request(app)
      .post(`/api/itineraries/${id}/invites`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({});

    const res = await request(app)
      .get(`/api/itineraries/${id}?invite=${encodeURIComponent(created.body.invite.token)}`);
    expect(res.status).toBe(200);
  });

  it("revoked invite returns 410 from resolve and 404 from itinerary GET", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "revoker" });
    const id = await generatePrivate(app, owner.token);
    const created = await request(app)
      .post(`/api/itineraries/${id}/invites`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({});
    const token = created.body.invite.token;

    await request(app)
      .delete(`/api/itineraries/invites/${created.body.invite.id}`)
      .set("authorization", `Bearer ${owner.token}`);

    const resolve = await request(app).get(`/api/invites/${encodeURIComponent(token)}`);
    expect(resolve.status).toBe(410);
    expect(resolve.body.error.code).toBe("invite_revoked");

    const view = await request(app)
      .get(`/api/itineraries/${id}`)
      .set(INVITE_TOKEN_HEADER, token);
    expect(view.status).toBe(404);
  });

  it("token for itinerary A does not grant access to itinerary B", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "cross_owner" });
    const idA = await generatePrivate(app, owner.token, "Kyoto");
    const idB = await generatePrivate(app, owner.token, "Lisbon");
    const created = await request(app)
      .post(`/api/itineraries/${idA}/invites`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({});

    const res = await request(app)
      .get(`/api/itineraries/${idB}`)
      .set(INVITE_TOKEN_HEADER, created.body.invite.token);
    expect(res.status).toBe(404);
  });

  it("unknown token returns 404 from resolve", async () => {
    const app = createApp();
    const res = await request(app).get(`/api/invites/doesnotexist1234`);
    expect(res.status).toBe(404);
  });
});

describe("invites — comments via invite", () => {
  it("authenticated viewer with an invite can comment on a private itinerary", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "cmt_owner" });
    const viewer = await signup(app, { username: "cmt_viewer" });
    const id = await generatePrivate(app, owner.token);
    const created = await request(app)
      .post(`/api/itineraries/${id}/invites`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({});

    const post = await request(app)
      .post(`/api/itineraries/${id}/comments`)
      .set("authorization", `Bearer ${viewer.token}`)
      .set(INVITE_TOKEN_HEADER, created.body.invite.token)
      .send({ text: "excited!" });
    expect(post.status).toBe(201);
    expect(post.body.comment.text).toBe("excited!");

    const list = await request(app)
      .get(`/api/itineraries/${id}/comments`)
      .set("authorization", `Bearer ${owner.token}`);
    expect(list.status).toBe(200);
    expect(list.body.comments).toHaveLength(1);
  });

  it("authenticated viewer without an invite cannot comment on a private itinerary", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "blocked_owner" });
    const viewer = await signup(app, { username: "blocked_viewer" });
    const id = await generatePrivate(app, owner.token);

    const post = await request(app)
      .post(`/api/itineraries/${id}/comments`)
      .set("authorization", `Bearer ${viewer.token}`)
      .send({ text: "sneak" });
    expect(post.status).toBe(404);
  });
});

describe("invites — cascade on itinerary delete", () => {
  it("deleting the itinerary removes its invites", async () => {
    const app = createApp();
    const owner = await signup(app, { username: "cascade_owner" });
    const id = await generatePrivate(app, owner.token);
    await request(app)
      .post(`/api/itineraries/${id}/invites`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({});
    await request(app)
      .post(`/api/itineraries/${id}/invites`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({});

    const before = await InviteModel.countDocuments({ itineraryId: id });
    expect(before).toBe(2);

    await request(app)
      .delete(`/api/itineraries/${id}`)
      .set("authorization", `Bearer ${owner.token}`);

    const after = await InviteModel.countDocuments({ itineraryId: id });
    expect(after).toBe(0);
  });
});
