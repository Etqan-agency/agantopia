import { HireEmployeeInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../server/authz";
import { created, parseBody, parseQuery, route } from "../../../../../server/http";
import { EmployeeListQuery, hireEmployee, listEmployees } from "../../../../../server/services/employees";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return { items: await listEmployees(cid, parseQuery(EmployeeListQuery, req)), nextCursor: null };
});

export const POST = route<P>(async (req, { cid }) => {
  const { session } = await authorizeCompany(req, cid);
  return created(await hireEmployee(cid, session.user.id, await parseBody(HireEmployeeInput, req)));
});
