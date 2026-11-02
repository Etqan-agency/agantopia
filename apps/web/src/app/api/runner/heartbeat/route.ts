import { readJson, route } from "../../../../server/http";
import { authenticateRunner, handleHeartbeat } from "../../../../server/services/runners";

export const POST = route(async (req) => {
  const runner = await authenticateRunner(req);
  return handleHeartbeat(runner, await readJson(req));
});
