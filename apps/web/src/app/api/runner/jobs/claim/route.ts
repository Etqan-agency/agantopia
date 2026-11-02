import { route } from "../../../../../server/http";
import { authenticateRunner, handleClaim } from "../../../../../server/services/runners";

export const POST = route(async (req) => {
  const runner = await authenticateRunner(req);
  return handleClaim(runner);
});
