import { DecideApprovalInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../server/authz";
import { parseBody, route } from "../../../../../../server/http";
import { decideApproval } from "../../../../../../server/services/tasks";

type P = { cid: string; aid: string };

export const POST = route<P>(
  async (req, { cid, aid }) => {
    const { session } = await authorizeCompany(req, cid);
    return decideApproval(cid, session.user.id, aid, await parseBody(DecideApprovalInput, req));
  },
  { rateLimit: "strict" },
);
