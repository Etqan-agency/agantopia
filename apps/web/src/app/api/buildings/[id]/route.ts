import { RenameBuildingInput } from "@agentopia/shared";
import { requireSession } from "../../../../server/authz";
import { parseBody, route } from "../../../../server/http";
import { renameBuilding } from "../../../../server/services/companies";

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireSession(req);
  return renameBuilding(user.id, id, await parseBody(RenameBuildingInput, req));
});
