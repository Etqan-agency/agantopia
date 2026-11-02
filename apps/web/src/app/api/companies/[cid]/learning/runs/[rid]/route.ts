import { authorizeCompany } from "../../../../../../../server/authz";
import { route } from "../../../../../../../server/http";
import { getRun } from "../../../../../../../server/services/learning";

type P = { cid: string; rid: string };

export const GET = route<P>(async (req, { cid, rid }) => {
  await authorizeCompany(req, cid);
  return getRun(cid, rid);
});
