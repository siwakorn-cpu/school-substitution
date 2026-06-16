import { clearSession } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  await clearSession();
  return redirectTo(request, "/login");
}
