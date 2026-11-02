import { authorizeCompany } from "../../../../../../../server/authz";
import { route } from "../../../../../../../server/http";
import { listEvidence } from "../../../../../../../server/services/employees";

type P = { cid: string; eid: string };

export const GET = route<P>(async (req, { cid, eid }) => {
  await authorizeCompany(req, cid);
  return { items: await listEvidence(cid, eid), nextCursor: null };
});
