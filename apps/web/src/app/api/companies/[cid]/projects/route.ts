import { CreateProjectInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../server/authz";
import { created, parseBody, route } from "../../../../../server/http";
import { createProject, listProjects } from "../../../../../server/services/tasks";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return { items: await listProjects(cid), nextCursor: null };
});

export const POST = route<P>(async (req, { cid }) => {
  const { session } = await authorizeCompany(req, cid);
  return created(await createProject(cid, session.user.id, await parseBody(CreateProjectInput, req)));
});
