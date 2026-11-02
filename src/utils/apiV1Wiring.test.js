import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";

// /api/v1 is the address the iOS app calls, and the reason it exists at all
// is that an app, unlike this website, can't be redeployed. Once a build is on
// someone's phone it keeps calling the same paths and reading the same fields
// for as long as they don't update, and App Review stands between any fix and
// that phone. So, from the first App Store release:
//
//   - A response field under /api/v1 may be added, never removed or renamed.
//   - A change that can't follow that rule gets /api/v2 alongside, and v1
//     keeps answering until /api/v1/client-config has asked old builds to
//     update.
//
// Today each v1 route re-exports the unversioned one, so the two can't drift
// and the website needn't change. This file keeps that true: every route has a
// v1 twin, the twin exposes the same methods, and route settings Next reads
// from the file itself (dynamic) are restated there, because Next doesn't
// follow a re-export to find them.
//
// It reads the routes as text, like the other wiring tests: importing a route
// would drag in the Supabase admin client.

const API = resolve(process.cwd(), "app/api");
const V1 = join(API, "v1");

function routeFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.js" ? [path] : [];
  });
}

function methods(source) {
  return [...source.matchAll(/^export async function (GET|POST|PUT|PATCH|DELETE)\b/gm)].map((match) => match[1]).sort();
}

function reexportedMethods(source) {
  const match = source.match(/^export \{([^}]*)\} from /m);
  return match ? match[1].split(",").map((name) => name.trim()).filter(Boolean).sort() : [];
}

function dynamicSetting(source) {
  return source.match(/^export const dynamic = "([^"]+)"/m)?.[1] ?? null;
}

const unversioned = routeFiles(API).filter((path) => !path.startsWith(V1 + "/"));

describe("/api/v1", () => {
  it("finds the routes it's guarding", () => {
    expect(unversioned.length).toBeGreaterThan(5);
  });

  for (const path of unversioned) {
    const name = relative(API, path).replace(/\/route\.js$/, "");

    describe(`/api/${name}`, () => {
      const original = readFileSync(path, "utf8");
      const twinPath = join(V1, name, "route.js");
      let twin = "";
      try {
        twin = readFileSync(twinPath, "utf8");
      } catch {
        // Reported by the first assertion below.
      }

      it("has a /api/v1 twin", () => {
        expect(twin, `add app/api/v1/${name}/route.js re-exporting app/api/${name}/route.js`).not.toBe("");
      });

      it("re-exports the original rather than copying it", () => {
        expect(twin).toMatch(new RegExp(`from "(\\.\\./)+${name}/route";`));
      });

      it("answers the same methods", () => {
        expect(reexportedMethods(twin)).toEqual(methods(original));
      });

      it("restates the original's dynamic setting", () => {
        expect(dynamicSetting(twin)).toBe(dynamicSetting(original));
      });
    });
  }
});
