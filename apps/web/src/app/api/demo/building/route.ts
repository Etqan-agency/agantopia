import { route } from "../../../../server/http";
import { getDemoBuilding } from "../../../../server/services/demo";

export const GET = route(async () => getDemoBuilding());
