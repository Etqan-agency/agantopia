import { CreateSkillInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../server/authz";
import { created, parseBody, route } from "../../../../../server/http";
import { createSkill, listSkills } from "../../../../../server/services/skills";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return { items: await listSkills(cid), nextCursor: null };
});

export const POST = route<P>(async (req, { cid }) => {
  const { session } = await authorizeCompany(req, cid);
  return created(await createSkill(cid, session.user.id, await parseBody(CreateSkillInput, req)));
});
