import globals from "globals";
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
  ...nextCoreWebVitals,

  // A name the file never defines is a crash, and it is a crash the two things
  // this project does gate on cannot see. The build compiles a reference to a
  // name that is not there -- resolving it is the runtime's job, not the
  // bundler's -- and the unit tests exercise src/utils, which is not where
  // components live. So a component that reads a variable belonging to some
  // other component ships green and throws the moment that branch renders.
  //
  // It has happened twice. `hasEstimate` was used in a card's ledger rows
  // without being imported, and later #189 added `currentUser` and
  // `recoverItemPhotos` to a PhotoViewerModal inside InventoryPage, which
  // receives neither -- so opening any photo threw and the error boundary
  // replaced the app with "This page couldn't load". Both were found by a
  // person clicking the feature.
  //
  // eslint-config-next does not enable this rule, and the rule needs to be
  // told what the environment provides or every `window` and `console` becomes
  // a finding -- which is why the globals below come with it rather than
  // separately. Scoped to the file types this repo actually holds: ESLint 9
  // lints only .js by default, and .jsx is where the components are.
  //
  // The rest of `npm run lint` still reports a pre-existing backlog and is
  // still not a gate. This rule is clean today and CI keeps it that way; see
  // the lint step in .github/workflows/ci.yml.
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "no-undef": "error" }
  }
];

export default config;
