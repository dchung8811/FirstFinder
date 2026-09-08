// The same standalone shell the identification pages use, and for the same
// reason set out in app/books/layout.js: the app's nav and footer live inside
// the 6,000-line client component in app/InventoryApp.jsx and cannot be
// imported into a server component. Duplicating a header is the cheaper
// mistake.
export default function AdminLayout({ children }) {
  return <div className="min-h-screen bg-[#f6efe3] text-[#201a14]">{children}</div>;
}
