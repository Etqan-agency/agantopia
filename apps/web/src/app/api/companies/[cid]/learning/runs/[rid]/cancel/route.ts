import { authorizeCompany } from "../../../../../../../../server/authz";
import { route } from "../../../../../../../../server/http";
import { cancelRun } from "../../../../../../../../server/services/learning";

type P = { cid: string; rid: string };

export const POST = route<P>(async (req, { cid, rid }) => {
  const { session } = await authorizeCompany(req, cid);
  return cancelRun(cid, session.user.id, rid);
});
