import { authorizeCompany } from "../../../../../../server/authz";
import { route } from "../../../../../../server/http";
import { revokeRunner } from "../../../../../../server/services/runners";

type P = { cid: string; rid: string };

export const DELETE = route<P>(async (req, { cid, rid }) => {
  const { session } = await authorizeCompany(req, cid, { owner: true });
  return revokeRunner(cid, session.user.id, rid);
});
