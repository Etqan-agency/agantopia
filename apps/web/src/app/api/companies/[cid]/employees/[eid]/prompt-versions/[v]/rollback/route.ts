import { z } from "zod";
import { authorizeCompany } from "../../../../../../../../../server/authz";
import { created, route } from "../../../../../../../../../server/http";
import { rollbackPromptVersion } from "../../../../../../../../../server/services/employees";

type P = { cid: string; eid: string; v: string };

export const POST = route<P>(async (req, { cid, eid, v }) => {
  const { session } = await authorizeCompany(req, cid);
  const version = z.coerce.number().int().min(1).parse(v);
  return created(await rollbackPromptVersion(cid, session.user.id, eid, version));
});
