import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bootstrap } from "./_lib/handler";

export default function handler(req: VercelRequest, res: VercelResponse) {
  return bootstrap(req, res);
}
