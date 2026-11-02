import { authorizeCompany } from "../../../../../server/authz";
import { parseQuery, route } from "../../../../../server/http";
import { UsageQuery, usageSummary } from "../../../../../server/services/usage";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return usageSummary(cid, parseQuery(UsageQuery, req));
});
