import { redirect } from "next/navigation";

// /ideas is now a tab inside /system — redirect permanently
export default function IdeasRedirect() {
  redirect("/intelligence");
}
