import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { LoginBody, GetMeResponse } from "@workspace/api-zod";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const body = LoginBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const { email, password } = body.data;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || user.passwordHash !== password) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser, token: `mock-token-${user.id}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.replace("Bearer ", "");
  const userId = token.replace("mock-token-", "");
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    const { passwordHash: _, ...safeUser } = user;
    const parsed = GetMeResponse.safeParse(safeUser);
    res.json(parsed.success ? parsed.data : safeUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
