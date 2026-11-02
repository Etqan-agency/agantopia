import { authorizeCompany } from "../../../../../../../server/authz";
import { route } from "../../../../../../../server/http";
import { deleteSource } from "../../../../../../../server/services/learning";

type P = { cid: string; sid: string };

export const DELETE = route<P>(async (req, { cid, sid }) => {
  const { session } = await authorizeCompany(req, cid);
  return deleteSource(cid, session.user.id, sid);
});
