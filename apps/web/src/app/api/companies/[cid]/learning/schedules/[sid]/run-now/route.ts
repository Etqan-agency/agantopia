import { authorizeCompany } from "../../../../../../../../server/authz";
import { parseBody, route } from "../../../../../../../../server/http";
import { RunScheduleNowInput, runScheduleNow } from "../../../../../../../../server/services/learning";

type P = { cid: string; sid: string };

export const POST = route<P>(
  async (req, { cid, sid }) => {
    const { session } = await authorizeCompany(req, cid);
    return runScheduleNow(cid, session.user.id, sid, await parseBody(RunScheduleNowInput, req));
  },
  { rateLimit: "strict" },
);
