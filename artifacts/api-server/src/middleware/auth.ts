import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        orgId: string | null;
        role: string;
        name: string;
      };
    }
  }
}

/**
 * Attaches req.user from the Bearer mock-token-{userId} header.
 * Non-fatal — routes that don't need auth still work.
 */
export async function resolveUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer mock-token-")) {
    return next();
  }
  const userId = header.replace("Bearer mock-token-", "");
  try {
    const [user] = await db
      .select({ id: usersTable.id, orgId: usersTable.orgId, role: usersTable.role, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (user) {
      req.user = { userId: user.id, orgId: user.orgId, role: user.role, name: user.name };
    }
  } catch {
    // silently skip — public routes still work
  }
  next();
}
