import { route } from "../../../../server/http";
import { getDemoScript } from "../../../../server/services/demo";

export const GET = route(async () => getDemoScript());
