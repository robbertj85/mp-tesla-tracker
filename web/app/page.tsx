import { redirect } from "next/navigation";

// The tracker is multi-brand; the root sends visitors to the default brand.
export default function Page() {
  redirect("/tesla");
}
