import { prisma } from "@agentopia/db";
import { authorizeCompany } from "../../../../../../server/authz";
import { badRequest } from "../../../../../../server/errors";
import { route } from "../../../../../../server/http";
import { openCompanyEventStream } from "../../../../../../server/services/event-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type P = { cid: string };

export const GET = route<P>(
  async (req, { cid }) => {
    await authorizeCompany(req, cid);
    const rawParam = new URL(req.url).searchParams.get("after") ?? req.headers.get("last-event-id");
    let after: number;
    if (rawParam === null || rawParam === "latest") {
      // No cursor: replay only the most recent events for context, then go live.
      // `after=latest` skips the replay entirely.
      const latest = await prisma.taskEvent.findFirst({ where: { companyId: cid }, orderBy: { seq: "desc" }, select: { seq: true } });
      const latestSeq = latest ? Number(latest.seq) : 0;
      after = rawParam === "latest" ? latestSeq : Math.max(0, latestSeq - 50);
    } else {
      after = Number.parseInt(rawParam, 10);
      if (!Number.isFinite(after) || after < 0) throw badRequest("`after` must be a non-negative integer or `latest`");
    }
    return openCompanyEventStream(cid, after, req.signal);
  },
  { rateLimit: "default" },
);
