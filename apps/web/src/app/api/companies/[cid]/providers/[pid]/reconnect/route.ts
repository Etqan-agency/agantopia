import { authorizeCompany } from "../../../../../../../server/authz";
import { route } from "../../../../../../../server/http";
import { reconnectProvider } from "../../../../../../../server/services/providers";

type P = { cid: string; pid: string };

export const POST = route<P>(
  async (req, { cid, pid }) => {
    const { session } = await authorizeCompany(req, cid, { owner: true });
    return reconnectProvider(cid, session.user.id, pid);
  },
  { rateLimit: "strict" },
);
