import { readJson, route } from "../../../../../../server/http";
import { authenticateRunner, handleEvents } from "../../../../../../server/services/runners";

export const POST = route<{ sid: string }>(async (req, { sid }) => {
  const runner = await authenticateRunner(req);
  return handleEvents(runner, sid, await readJson(req));
});
