import { CreateLearningSourceInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../server/authz";
import { created, parseBody, parseQuery, route } from "../../../../../../server/http";
import { createSource, listSources, SourceListQuery } from "../../../../../../server/services/learning";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return { items: await listSources(cid, parseQuery(SourceListQuery, req)), nextCursor: null };
});

export const POST = route<P>(async (req, { cid }) => {
  const { session } = await authorizeCompany(req, cid);
  return created(await createSource(cid, session.user.id, await parseBody(CreateLearningSourceInput, req)));
});
