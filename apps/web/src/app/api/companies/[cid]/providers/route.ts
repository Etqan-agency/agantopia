import { CreateProviderConnectionInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../server/authz";
import { created, parseBody, route } from "../../../../../server/http";
import { createProvider, listProviders } from "../../../../../server/services/providers";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return { items: await listProviders(cid), nextCursor: null };
});

export const POST = route<P>(
  async (req, { cid }) => {
    const { session } = await authorizeCompany(req, cid, { owner: true });
    return created(await createProvider(cid, session.user.id, await parseBody(CreateProviderConnectionInput, req)));
  },
  { rateLimit: "strict" },
);
