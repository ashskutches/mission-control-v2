import { redirect } from "next/navigation";

/** SMS testing moved to /orders/sms along with the rest of /customer. See ../page.tsx. */
export default function CustomerSmsRedirect() {
  redirect("/orders/sms");
}
