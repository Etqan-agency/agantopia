import { DecideKnowledgeInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../../server/authz";
import { parseBody, route } from "../../../../../../../server/http";
import { decideKnowledge } from "../../../../../../../server/services/learning";

type P = { cid: string; kid: string };

export const POST = route<P>(async (req, { cid, kid }) => {
  const { session } = await authorizeCompany(req, cid);
  return decideKnowledge(cid, session.user.id, kid, await parseBody(DecideKnowledgeInput, req));
});
