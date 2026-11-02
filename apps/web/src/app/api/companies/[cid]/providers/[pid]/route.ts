import { authorizeCompany } from "../../../../../../server/authz";
import { parseBody, route } from "../../../../../../server/http";
import { revokeProvider, UpdateProviderInput, updateProvider } from "../../../../../../server/services/providers";

type P = { cid: string; pid: string };

export const PATCH = route<P>(
  async (req, { cid, pid }) => {
    const { session } = await authorizeCompany(req, cid, { owner: true });
    return updateProvider(cid, session.user.id, pid, await parseBody(UpdateProviderInput, req));
  },
  { rateLimit: "strict" },
);

export const DELETE = route<P>(
  async (req, { cid, pid }) => {
    const { session } = await authorizeCompany(req, cid, { owner: true });
    return revokeProvider(cid, session.user.id, pid);
  },
  { rateLimit: "strict" },
);
