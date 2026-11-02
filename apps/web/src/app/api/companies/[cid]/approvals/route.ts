import { authorizeCompany } from "../../../../../server/authz";
import { parseQuery, route } from "../../../../../server/http";
import { ApprovalListQuery, listApprovals } from "../../../../../server/services/tasks";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return { items: await listApprovals(cid, parseQuery(ApprovalListQuery, req)), nextCursor: null };
});
