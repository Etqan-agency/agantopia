import { CreateCompanyInput } from "@agentopia/shared";
import { requireSession } from "../../../server/authz";
import { created, parseBody, route } from "../../../server/http";
import { createCompany } from "../../../server/services/companies";

export const POST = route(async (req) => {
  const { user } = await requireSession(req);
  return created(await createCompany(user.id, await parseBody(CreateCompanyInput, req)));
});
