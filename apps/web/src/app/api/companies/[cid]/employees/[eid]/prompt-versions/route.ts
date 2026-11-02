import { CreatePromptVersionInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../../server/authz";
import { created, parseBody, route } from "../../../../../../../server/http";
import { createPromptVersion, listPromptVersions } from "../../../../../../../server/services/employees";

type P = { cid: string; eid: string };

export const GET = route<P>(async (req, { cid, eid }) => {
  await authorizeCompany(req, cid);
  return { items: await listPromptVersions(cid, eid), nextCursor: null };
});

export const POST = route<P>(async (req, { cid, eid }) => {
  const { session } = await authorizeCompany(req, cid);
  return created(await createPromptVersion(cid, session.user.id, eid, await parseBody(CreatePromptVersionInput, req)));
});
