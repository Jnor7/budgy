import { redirect } from "next/navigation";

/** La gestion locative est devenue un module de premier niveau : /rentals. */
export default function LegacyTenantsPage() {
  redirect("/rentals");
}
