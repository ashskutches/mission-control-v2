import { redirect } from "next/navigation";

// Legacy SPA entry — redirect to the (dashboard) group which serves /
export default function LegacyRoot() {
  redirect("/");
}
