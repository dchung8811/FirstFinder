"use client";

// The nav bar: wordmark, a row of tabs that sheds whatever doesn't fit into a
// menu behind a hamburger, and an account button.
//
// Taken out of app/InventoryApp.jsx -- the only piece of that file moved on
// purpose -- because /explore has to wear the same bar, and /explore is its
// own route that can't render inside the app. A copy would drift the first
// time a tab changed; this way the app and Explore draw the same component,
// and src/utils/appNav.js decides what is in it for both.

import React, { useCallback, useEffect, useRef, useState } from "react";

// Measures the tabs at their natural width against the space the nav actually
// has and reports how many fit. Everything past that goes into the menu, so the
// pill never scrolls and never spills over the buttons beside it.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : React.useLayoutEffect;

function useNavOverflow(containerRef, measureRef, items, onCountChange) {
  const [visibleCount, setVisibleCount] = useState(items.length);
  const lastCountRef = useRef(items.length);
  const signature = items.map((navItem) => navItem.label).join("|");

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return undefined;

    function recompute() {
      const widths = Array.from(measure.children).map((child) => child.getBoundingClientRect().width);
      // The pill's own border and p-1 padding, which the tabs have to share the
      // slot with.
      const available = container.clientWidth - 10;
      const gap = 4;
      let used = 0;
      let count = 0;
      for (let index = 0; index < widths.length; index += 1) {
        const next = used + widths[index] + (index === 0 ? 0 : gap);
        if (next > available) break;
        used = next;
        count += 1;
      }
      setVisibleCount(count);
      if (count !== lastCountRef.current) {
        lastCountRef.current = count;
        onCountChange();
      }
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [signature, onCountChange]);

  return Math.min(visibleCount, items.length);
}

function NavTabs({ items, activeView, onSelect, containerRef, measureRef, visibleCount }) {
  return (
    <div ref={containerRef} className="relative flex min-w-0 flex-1 justify-center">
      {/* A copy of every tab at its natural width, sealed inside a zero-sized
          box so it can be measured without adding a pixel of scrollable area. */}
      <div aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden">
        <div ref={measureRef} className="flex flex-nowrap items-center gap-1">
          {items.map((navItem) => (
            <TabButton key={navItem.view} active={false} onClick={() => {}}>{navItem.label}</TabButton>
          ))}
        </div>
      </div>
      {visibleCount > 0 && (
        <div className="flex max-w-full flex-nowrap items-center gap-1 overflow-hidden rounded-full border border-[#d8c7ad] bg-[#fff8ee] p-1">
          {items.slice(0, visibleCount).map((navItem) => (
            <TabButton key={navItem.view} active={activeView === navItem.view} onClick={() => onSelect(navItem.view)}>{navItem.label}</TabButton>
          ))}
        </div>
      )}
    </div>
  );
}


export function TabButton({ active, children, onClick }) { return <button onClick={onClick} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${active ? "bg-[#123f38] text-[#fff7ea]" : "text-[#665746] hover:bg-white"}`}>{children}</button>; }
function MobileNavLink({ active, children, onClick }) { return <button onClick={onClick} className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition ${active ? "bg-[#123f38] text-[#fff7ea]" : "text-[#665746] hover:bg-white"}`}>{children}</button>; }

function MenuIcon({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={open ? "M18 6 6 18M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
    </svg>
  );
}

// `items` come from appNavItems. `onSelect` gets the chosen item and decides
// what choosing it means -- switching a view inside the app, or following a
// link out of a page that isn't the app. `account` is the button at the end
// (Log in or Log out), drawn by the caller because only it knows how to sign
// someone in or out. `menuExtras` are items that only ever sit in the menu.
export default function SiteNav({ items, activeView, onSelect, onHome, account, menuExtras = [] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const slotRef = useRef(null);
  const measureRef = useRef(null);
  // Wraps the hamburger and its dropdown, so a click landing anywhere else can
  // be told apart from a click inside the open menu.
  const menuRef = useRef(null);

  // Resizing reshuffles which tabs are behind the menu, so close it rather
  // than leave a panel open over a list that just changed under the reader.
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const visibleCount = useNavOverflow(slotRef, measureRef, items, closeMenu);

  // Admin and the like are appended here rather than added to `items`, so they
  // never compete for a slot in the visible row however wide the window is,
  // and the overflow measurement reads exactly the tabs everyone else gets.
  const menuItems = [...items.slice(visibleCount), ...menuExtras];

  // A dropdown has to be dismissible by the two gestures everyone already
  // expects of one -- click away, press Escape -- or it reads as a panel that
  // got stuck open. Only listening while it is actually open keeps this off
  // the event path for every other click on the page.
  useEffect(() => {
    if (!menuOpen) return undefined;

    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }

    function onKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function select(view) {
    setMenuOpen(false);
    const item = [...items, ...menuExtras].find((navItem) => navItem.view === view);
    if (item) onSelect(item);
  }

  return (
    <nav className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-5 md:gap-8 print:hidden">
      {/* min-w-0 rather than shrink-0, and the tagline is hidden on the
          narrowest screens. With shrink-0 here the wordmark held its full
          322px on a 375px phone, so nothing in the row could give way and
          the log out button was pushed ~130px past the right edge -- which
          mobile Safari answers by shrinking the whole page to fit, leaving
          a white gutter down the side of every view. */}
      <button type="button" onClick={onHome} className="flex min-w-0 items-center gap-3 text-left">
        <img src="/firstfinder-mark-exact.png" alt="FirstFinder logo" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold tracking-tight">FirstFinder</div>
          <div className="hidden truncate text-xs uppercase tracking-[0.22em] text-[#746655] sm:block">Your collection, catalogued</div>
        </div>
      </button>

      <NavTabs
        items={items}
        activeView={activeView}
        onSelect={select}
        containerRef={slotRef}
        measureRef={measureRef}
        visibleCount={visibleCount}
      />

      <div className="flex shrink-0 items-center gap-2">
        {account}
        {menuItems.length > 0 && (
          /* The menu is positioned against this wrapper rather than laid out
             in the page. It used to render as a full-width block below the
             nav, which pushed the whole page down on every open and read as
             a section of the page rather than a menu belonging to the
             button. Anchoring it here keeps it the size of its contents and
             leaves the layout underneath alone. */
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d8c7ad] bg-[#fff8ee] text-[#201a14] hover:bg-white"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <MenuIcon open={menuOpen} />
            </button>

            {menuOpen && (
              /* right-0 rather than left-0: the button sits at the end of the
                 nav, so a menu growing rightwards would run off the screen on
                 a phone. z-40 keeps it above page content without going over
                 the toasts and modals, which sit higher. */
              <div
                role="menu"
                /* The height cap is not hypothetical: on the narrowest
                   screens the whole nav collapses in here, and eight items
                   stand ~400px tall -- taller than a phone's viewport in
                   landscape. Without this the last entries (Admin among
                   them, since it is appended last) sit below the fold with
                   no way to reach them. */
                className="absolute right-0 top-full z-40 mt-2 flex max-h-[calc(100vh-5rem)] w-56 max-w-[calc(100vw-2rem)] flex-col gap-1 overflow-y-auto rounded-2xl border border-[#d8c7ad] bg-[#fff8ee] p-2 shadow-[0_18px_40px_-18px_rgba(32,26,20,0.45)]"
              >
                {menuItems.map((navItem) => (
                  <MobileNavLink key={navItem.view} active={activeView === navItem.view} onClick={() => select(navItem.view)}>
                    {navItem.label}
                  </MobileNavLink>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
