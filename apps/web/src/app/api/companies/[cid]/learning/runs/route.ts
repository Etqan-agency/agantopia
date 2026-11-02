import { authorizeCompany } from "../../../../../../server/authz";
import { parseQuery, route } from "../../../../../../server/http";
import { listRuns, RunListQuery } from "../../../../../../server/services/learning";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return listRuns(cid, parseQuery(RunListQuery, req));
});
