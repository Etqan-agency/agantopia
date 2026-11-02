import { readJson, route } from "../../../../../../server/http";
import { authenticateRunner, handleComplete } from "../../../../../../server/services/runners";

export const POST = route<{ sid: string }>(async (req, { sid }) => {
  const runner = await authenticateRunner(req);
  return handleComplete(runner, sid, await readJson(req));
});
