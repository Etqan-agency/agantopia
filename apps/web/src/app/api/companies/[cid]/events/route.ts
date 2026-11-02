import { authorizeCompany } from "../../../../../server/authz";
import { parseQuery, route } from "../../../../../server/http";
import { EventsQuery, listEvents } from "../../../../../server/services/tasks";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return listEvents(cid, parseQuery(EventsQuery, req));
});
