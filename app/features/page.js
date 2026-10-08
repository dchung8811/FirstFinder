import InventoryApp from "../InventoryApp";
import { viewMetadata } from "../viewMetadata";

// The app's Features page at /features. Its own file rather than a [view]
// like the other app pages, because /features is already a folder: the
// feature guides live under it at /features/<name>, and link back here.
export const metadata = viewMetadata("features");

export default function FeaturesPage() {
  return <InventoryApp initialView="features" />;
}
