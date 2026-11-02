import { PaginationQuery } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../../server/authz";
import { parseQuery, route } from "../../../../../../../server/http";
import { listEmployeeTasks } from "../../../../../../../server/services/employees";

type P = { cid: string; eid: string };

export const GET = route<P>(async (req, { cid, eid }) => {
  await authorizeCompany(req, cid);
  return listEmployeeTasks(cid, eid, parseQuery(PaginationQuery, req));
});
