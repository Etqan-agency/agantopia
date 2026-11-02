import { authorizeCompany } from "../../../../../../server/authz";
import { route } from "../../../../../../server/http";
import { deleteKnowledge } from "../../../../../../server/services/learning";

type P = { cid: string; kid: string };

export const DELETE = route<P>(async (req, { cid, kid }) => {
  const { session } = await authorizeCompany(req, cid);
  return deleteKnowledge(cid, session.user.id, kid);
});
