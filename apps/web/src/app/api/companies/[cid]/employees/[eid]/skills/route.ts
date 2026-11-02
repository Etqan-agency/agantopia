import { SetEmployeeSkillsInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../../server/authz";
import { parseBody, route } from "../../../../../../../server/http";
import { setEmployeeSkills } from "../../../../../../../server/services/employees";

type P = { cid: string; eid: string };

export const PUT = route<P>(async (req, { cid, eid }) => {
  const { session } = await authorizeCompany(req, cid);
  return { items: await setEmployeeSkills(cid, session.user.id, eid, await parseBody(SetEmployeeSkillsInput, req)) };
});
