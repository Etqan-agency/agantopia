import { route } from "../../../../../../server/http";
import { authenticateRunner, handleControl } from "../../../../../../server/services/runners";

export const dynamic = "force-dynamic";

export const GET = route<{ sid: string }>(async (req, { sid }) => {
  const runner = await authenticateRunner(req);
  return handleControl(runner, sid);
});
