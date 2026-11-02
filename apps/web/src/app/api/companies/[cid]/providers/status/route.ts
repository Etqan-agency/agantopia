import { authorizeCompany } from "../../../../../../server/authz";
import { route } from "../../../../../../server/http";
import { getProviderStatuses } from "../../../../../../server/services/provider-status";

type P = { cid: string };

/** `ProviderStatusView[]`: one entry per provider (Claude Code, OpenAI Codex). */
export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return getProviderStatuses(cid);
});
