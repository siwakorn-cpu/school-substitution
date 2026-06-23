import { redirect } from "next/navigation";

export default function StartNewTermRedirectPage() {
  redirect("/settings/terms/start-new");
}
