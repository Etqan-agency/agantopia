import { route } from "../../../../../server/http";
import { getDemoEmployee } from "../../../../../server/services/demo";

export const GET = route<{ eid: string }>(async (_req, { eid }) => getDemoEmployee(eid));
