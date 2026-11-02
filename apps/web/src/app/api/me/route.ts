import { requireSession } from "../../../server/authz";
import { route } from "../../../server/http";
import { getMe } from "../../../server/services/companies";

export const GET = route(async (req) => {
  const { user } = await requireSession(req);
  return getMe(user);
});
