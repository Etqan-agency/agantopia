import { route } from "../../../../../../server/http";
import { getDemoFloorView } from "../../../../../../server/services/demo";

export const GET = route<{ fid: string }>(async (_req, { fid }) => getDemoFloorView(fid));
