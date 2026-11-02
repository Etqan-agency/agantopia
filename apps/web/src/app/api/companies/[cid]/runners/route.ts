import { CreateRunnerInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../server/authz";
import { created, parseBody, route } from "../../../../../server/http";
import { createRunner, listRunners } from "../../../../../server/services/runners";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return { items: await listRunners(cid), nextCursor: null };
});

export const POST = route<P>(
  async (req, { cid }) => {
    const { session } = await authorizeCompany(req, cid, { owner: true });
    return created(await createRunner(cid, session.user.id, await parseBody(CreateRunnerInput, req)));
  },
  { rateLimit: "strict" },
);
