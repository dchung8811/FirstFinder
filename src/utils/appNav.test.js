import { describe, expect, it } from "vitest";
import { appNavItems, landingView } from "./appNav";

const views = (items) => items.map((item) => item.view);

describe("appNavItems", () => {
  it("gives a signed-out visitor the short list", () => {
    expect(views(appNavItems({ isLoggedIn: false }))).toEqual(["home", "explore", "roadmap", "about"]);
  });

  it("gives a collector the full list, with Explore as a real link", () => {
    const items = appNavItems({ isLoggedIn: true });
    expect(views(items)).toEqual(["dashboard", "inventory", "wishlist", "addItems", "explore", "feedback", "about", "roadmap", "account"]);
    expect(items.find((item) => item.view === "explore").href).toBe("/explore");
  });

  it("shows counts only once they are known", () => {
    const loading = appNavItems({ isLoggedIn: true });
    expect(loading[1].label).toBe("My Collection");
    const loaded = appNavItems({ isLoggedIn: true, inventoryCount: 0, wishlistCount: 3 });
    expect(loaded[1].label).toBe("My Collection (0)");
    expect(loaded[2].label).toBe("Wishlist (3)");
  });
});

describe("landingView", () => {
  it("opens the requested view for a collector", () => {
    expect(landingView("inventory", true)).toBe("inventory");
    expect(landingView("about", true)).toBe("about");
  });

  it("falls back to the dashboard for a collector asking for something unknown or signed-out only", () => {
    expect(landingView("nonsense", true)).toBe("dashboard");
    expect(landingView("login", true)).toBe("dashboard");
    expect(landingView(null, true)).toBe("dashboard");
  });

  it("sends a signed-out visitor asking for a collector's page to the login form", () => {
    expect(landingView("inventory", false)).toBe("login");
    expect(landingView("account", false)).toBe("login");
  });

  it("opens public views for a signed-out visitor, and home for anything else", () => {
    expect(landingView("about", false)).toBe("about");
    expect(landingView("signup", false)).toBe("signup");
    expect(landingView("admin", false)).toBe("home");
  });
});
