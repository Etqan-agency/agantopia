import { UpsertLearningScheduleInput } from "@agentopia/shared";
import { authorizeCompany } from "../../../../../../server/authz";
import { parseBody, route } from "../../../../../../server/http";
import { listSchedules, upsertSchedule } from "../../../../../../server/services/learning";

type P = { cid: string };

export const GET = route<P>(async (req, { cid }) => {
  await authorizeCompany(req, cid);
  return { items: await listSchedules(cid), nextCursor: null };
});

export const PUT = route<P>(async (req, { cid }) => {
  const { session } = await authorizeCompany(req, cid);
  return upsertSchedule(cid, session.user.id, await parseBody(UpsertLearningScheduleInput, req));
});
