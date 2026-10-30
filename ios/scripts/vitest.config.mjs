import { fileURLToPath } from "node:url";

// Runs only the iOS parity checks, which the repo's own config leaves out.
export default {
  test: {
    environment: "node",
    root: fileURLToPath(new URL(".", import.meta.url)),
    include: ["*-parity.test.js"]
  }
};
