import { UpdateFloorInput } from "@agentopia/shared";
import { requireSession } from "../../../../server/authz";
import { parseBody, route } from "../../../../server/http";
import { updateFloor } from "../../../../server/services/companies";

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireSession(req);
  return updateFloor(user.id, id, await parseBody(UpdateFloorInput, req));
});
