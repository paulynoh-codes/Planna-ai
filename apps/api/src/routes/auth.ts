import { Router } from "express";
import bcrypt from "bcryptjs";
import { signupSchema, loginSchema } from "@planna/shared";
import { UserModel, toPublicUser } from "../models/User.js";
import { ItineraryModel } from "../models/Itinerary.js";
import { signAccessToken } from "../services/jwt.js";
import { HttpError } from "../middleware/error.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/signup", async (req, res, next) => {
  try {
    const input = signupSchema.parse(req.body);
    const existing = await UserModel.findOne({
      $or: [{ email: input.email.toLowerCase() }, { username: input.username }],
    });
    if (existing) {
      throw new HttpError(409, "already_exists", "Email or username already in use");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await UserModel.create({
      email: input.email.toLowerCase(),
      username: input.username,
      displayName: input.displayName ?? input.username,
      passwordHash,
    });

    if (input.anonymousSessionId) {
      await ItineraryModel.updateMany(
        { anonymousSessionId: input.anonymousSessionId, ownerId: null },
        { $set: { ownerId: user._id, anonymousSessionId: null } },
      );
    }

    const accessToken = signAccessToken(user._id.toString());
    res.status(201).json({ user: toPublicUser(user), tokens: { accessToken } });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await UserModel.findOne({ email: input.email.toLowerCase() });
    if (!user) throw new HttpError(401, "invalid_credentials", "Email or password incorrect");
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new HttpError(401, "invalid_credentials", "Email or password incorrect");
    const accessToken = signAccessToken(user._id.toString());
    res.json({ user: toPublicUser(user), tokens: { accessToken } });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) throw new HttpError(404, "not_found", "User not found");
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});
