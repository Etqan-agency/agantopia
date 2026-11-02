import { UpdateEmployeeInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../server/authz";
import { parseBody, route } from "../../../../../../server/http";
import { getEmployeeDetail, updateEmployee } from "../../../../../../server/services/employees";

type P = { cid: string; eid: string };

export const GET = route<P>(async (req, { cid, eid }) => {
  await authorizeCompany(req, cid);
  return getEmployeeDetail(cid, eid);
});

export const PATCH = route<P>(async (req, { cid, eid }) => {
  const { session } = await authorizeCompany(req, cid);
  return updateEmployee(cid, session.user.id, eid, await parseBody(UpdateEmployeeInput, req));
});
