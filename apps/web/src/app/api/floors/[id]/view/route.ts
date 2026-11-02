import { requireFloorAccess, requireSession } from "../../../../../server/authz";
import { route } from "../../../../../server/http";
import { buildFloorView } from "../../../../../server/services/floor-view";

export const GET = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireSession(req);
  await requireFloorAccess(user.id, id);
  return buildFloorView(id);
});
