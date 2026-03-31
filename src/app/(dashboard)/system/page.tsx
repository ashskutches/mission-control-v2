import { redirect } from "next/navigation";

// /system is now /blockages
export default function SystemPage() {
  redirect("/blockages");
}
