import { RenameBuildingInput } from "@agentopia/shared";
import { requireSession } from "../../../server/authz";
import { created, parseBody, route } from "../../../server/http";
import { createBuilding } from "../../../server/services/companies";

export const POST = route(async (req) => {
  const { user } = await requireSession(req);
  return created(await createBuilding(user.id, await parseBody(RenameBuildingInput, req)));
});
