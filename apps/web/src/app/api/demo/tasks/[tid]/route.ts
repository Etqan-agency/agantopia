import { route } from "../../../../../server/http";
import { getDemoTask } from "../../../../../server/services/demo";

export const GET = route<{ tid: string }>(async (_req, { tid }) => getDemoTask(tid));
