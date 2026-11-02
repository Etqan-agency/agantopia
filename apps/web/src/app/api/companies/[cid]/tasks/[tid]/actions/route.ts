import { TaskActionInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../../server/authz";
import { parseBody, route } from "../../../../../../../server/http";
import { taskAction } from "../../../../../../../server/services/tasks";

type P = { cid: string; tid: string };

export const POST = route<P>(
  async (req, { cid, tid }) => {
    const { session } = await authorizeCompany(req, cid);
    return taskAction(cid, session.user.id, tid, await parseBody(TaskActionInput, req));
  },
  { rateLimit: "strict" },
);
