import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// `next lint` was removed in Next 16, so ESLint runs directly and reads this
// flat config. eslint-config-next now ships flat configs itself, so there is no
// FlatCompat shim in the way. Next's preset carries the React and react-hooks
// rules that catch real bugs here -- an effect missing a dependency, a hook
// called conditionally.
//
// Not yet a CI gate: it currently reports pre-existing findings in
// InventoryApp.jsx and the books pages. Fix those, then add `npm run lint` to
// the workflow.
const config = [
  { ignores: [".next/**", "node_modules/**", "out/**"] },
  ...nextCoreWebVitals
];

export default config;
