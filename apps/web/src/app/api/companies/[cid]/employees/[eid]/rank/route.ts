import { OverrideRankInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../../server/authz";
import { parseBody, route } from "../../../../../../../server/http";
import { overrideRank } from "../../../../../../../server/services/employees";

type P = { cid: string; eid: string };

export const POST = route<P>(async (req, { cid, eid }) => {
  const { session } = await authorizeCompany(req, cid, { owner: true });
  return overrideRank(cid, session.user.id, eid, await parseBody(OverrideRankInput, req));
});
