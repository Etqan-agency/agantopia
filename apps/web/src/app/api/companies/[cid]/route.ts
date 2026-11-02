import { UpdateCompanyInput } from "@agentopia/shared";
import { requireSession } from "../../../../server/authz";
import { parseBody, route } from "../../../../server/http";
import { archiveCompany, getCompany, updateCompany } from "../../../../server/services/companies";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  const { user } = await requireSession(req);
  return getCompany(user.id, cid);
});

export const PATCH = route<P>(async (req, { cid }) => {
  const { user } = await requireSession(req);
  return updateCompany(user.id, cid, await parseBody(UpdateCompanyInput, req));
});

export const DELETE = route<P>(async (req, { cid }) => {
  const { user } = await requireSession(req);
  return archiveCompany(user.id, cid);
});
