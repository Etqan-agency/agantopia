import { UpdateSkillInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../server/authz";
import { parseBody, route } from "../../../../../../server/http";
import { deleteSkill, updateSkill } from "../../../../../../server/services/skills";

type P = { cid: string; sid: string };

export const PATCH = route<P>(async (req, { cid, sid }) => {
  const { session } = await authorizeCompany(req, cid);
  return updateSkill(cid, session.user.id, sid, await parseBody(UpdateSkillInput, req));
});

export const DELETE = route<P>(async (req, { cid, sid }) => {
  const { session } = await authorizeCompany(req, cid);
  return deleteSkill(cid, session.user.id, sid);
});
