import { CreateFloorInput } from "@agentopia/shared";
import { requireSession } from "../../../server/authz";
import { created, parseBody, route } from "../../../server/http";
import { createFloor } from "../../../server/services/companies";

export const POST = route(async (req) => {
  const { user } = await requireSession(req);
  return created(await createFloor(user.id, await parseBody(CreateFloorInput, req)));
});
