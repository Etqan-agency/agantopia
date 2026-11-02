import { CreateKnowledgeInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../server/authz";
import { created, parseBody, parseQuery, route } from "../../../../../server/http";
import { createKnowledge, KnowledgeListQuery, listKnowledge } from "../../../../../server/services/learning";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return listKnowledge(cid, parseQuery(KnowledgeListQuery, req));
});

export const POST = route<P>(async (req, { cid }) => {
  const { session } = await authorizeCompany(req, cid);
  return created(await createKnowledge(cid, session.user.id, await parseBody(CreateKnowledgeInput, req)));
});
