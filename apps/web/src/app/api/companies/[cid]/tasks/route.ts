import { CreateTaskInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../server/authz";
import { created, parseBody, parseQuery, route } from "../../../../../server/http";
import { createTask, listTasks, TaskListQuery } from "../../../../../server/services/tasks";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return listTasks(cid, parseQuery(TaskListQuery, req));
});

export const POST = route<P>(
  async (req, { cid }) => {
    const { session } = await authorizeCompany(req, cid);
    return created(await createTask(cid, session.user.id, await parseBody(CreateTaskInput, req)));
  },
  { rateLimit: "strict" },
);
