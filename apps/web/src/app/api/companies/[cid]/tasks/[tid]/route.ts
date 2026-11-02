import { authorizeCompany } from "../../../../../../server/authz";
import { route } from "../../../../../../server/http";
import { getTaskDetail } from "../../../../../../server/services/tasks";

type P = { cid: string; tid: string };

export const GET = route<P>(async (req, { cid, tid }) => {
  await authorizeCompany(req, cid);
  return getTaskDetail(cid, tid);
});
