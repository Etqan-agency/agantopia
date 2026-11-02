import { parseQuery, route } from "../../../../server/http";
import { DemoTasksQuery, listDemoTasks } from "../../../../server/services/demo";

export const GET = route(async (req) => listDemoTasks(parseQuery(DemoTasksQuery, req)));
