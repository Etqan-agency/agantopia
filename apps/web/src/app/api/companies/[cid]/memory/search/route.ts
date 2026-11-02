import { MemorySearchQuery } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../server/authz";
import { parseQuery, route } from "../../../../../../server/http";
import { memorySearch } from "../../../../../../server/services/learning";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return memorySearch(cid, parseQuery(MemorySearchQuery, req));
});
