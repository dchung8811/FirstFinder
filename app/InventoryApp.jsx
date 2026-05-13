"use client";
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../src/lib/supabaseClient";

const emptyItem = {
  name: "",
  category: "Book",
  maker: "",
  edition: "",
  status: "Owned",
  purchaseDate: "",
  source: "",
  purchasePrice: "",
  estimatedValue: "",
  notes: ""
};

const sampleItems = [
  {
    name: "The Gunslinger",
    category: "Book",
    maker: "Stephen King",
    edition: "First edition candidate",
    status: "Owned",
    purchaseDate: "2026-05-12",
    source: "Used bookstore",
    purchasePrice: "45",
    estimatedValue: "850",
    notes: "Need to confirm jacket state. Receipt saved for cost basis."
  },
  {
    name: "Beloved",
    category: "Book",
    maker: "Toni Morrison",
    edition: "Signed copy candidate",
    status: "Researching",
    purchaseDate: "2026-05-08",
    source: "Estate sale",
    purchasePrice: "30",
    estimatedValue: "300",
    notes: "Need signature verification before listing."
  },
  {
    name: "Vintage Phillies Program",
    category: "Sports memorabilia",
    maker: "Philadelphia Phillies",
    edition: "1970s program",
    status: "Owned",
    purchaseDate: "2026-04-28",
    source: "Flea market",
    purchasePrice: "12",
    estimatedValue: "40",
    notes: "Good condition, minor corner wear."
  }
];

const itemPhotoPrompts = ["Front", "Back", "Details", "Condition", "Signature/markings"];
const receiptPhotoPrompts = ["Receipt", "Invoice", "Order confirmation", "Auction record"];
const statuses = ["Owned", "Researching", "For sale", "Sold", "Wishlist"];
const quickCategories = ["Book", "Sports memorabilia", "Trading card", "Comic", "Record", "Art", "Toy", "Other"];
const csvHeaders = ["name", "category", "maker", "edition", "status", "purchaseDate", "source", "purchasePrice", "estimatedValue", "notes"];
const csvTemplateRows = [
  ["The Gunslinger", "Book", "Stephen King", "First edition candidate", "Owned", "2026-05-12", "Used bookstore", "45", "850", "Need to confirm jacket state"],
  ["Vintage Phillies Program", "Sports memorabilia", "Philadelphia Phillies", "1970s program", "Owned", "2026-04-28", "Flea market", "12", "40", "Minor corner wear"]
];
const mockAutofillOptions = [
  {
    match: "receipt",
    data: {
      name: "Receipt upload detected",
      category: "Book",
      maker: "Unknown",
      edition: "Needs item photo",
      status: "Owned",
      purchaseDate: "2026-05-12",
      source: "Receipt scan",
      purchasePrice: "45",
      estimatedValue: "",
      notes: "Autofilled from receipt photo. Review merchant, date, and purchase price."
    }
  },
  {
    match: "card",
    data: {
      name: "Collectible trading card",
      category: "Trading card",
      maker: "Unknown",
      edition: "Card photo detected",
      status: "Researching",
      purchaseDate: "2026-05-12",
      source: "Photo upload",
      purchasePrice: "",
      estimatedValue: "",
      notes: "Autofilled from item photo. Add grade, year, player/character, and set details."
    }
  },
  {
    match: "program",
    data: {
      name: "Vintage Phillies Program",
      category: "Sports memorabilia",
      maker: "Philadelphia Phillies",
      edition: "Program / publication",
      status: "Owned",
      purchaseDate: "2026-05-12",
      source: "Photo upload",
      purchasePrice: "12",
      estimatedValue: "40",
      notes: "Autofilled from photo. Review condition and event/year details."
    }
  },
  {
    match: "book",
    data: {
      name: "Book photo detected",
      category: "Book",
      maker: "Unknown author",
      edition: "Needs edition details",
      status: "Researching",
      purchaseDate: "2026-05-12",
      source: "Photo upload",
      purchasePrice: "",
      estimatedValue: "",
      notes: "Autofilled from book photo. Add author, edition, condition, and receipt proof."
    }
  }
];

function Icon({ name, size = 20, className = "" }) {
  const icons = {
    box: (
      <>
        <path d="M21 8 12 3 3 8l9 5 9-5Z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </>
    ),
    camera: (
      <>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    save: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />,
    receipt: (
      <>
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
      </>
    ),
    dollar: (
      <>
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    google: (
      <>
        <path d="M21.8 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.7 3.1-4.3 3.1-7.4Z" />
        <path d="M12 22c2.7 0 5-0.9 6.7-2.4L15.5 17c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.2H2.9v2.7A10 10 0 0 0 12 22Z" />
        <path d="M6.2 13.7a6 6 0 0 1 0-3.4V7.6H2.9a10 10 0 0 0 0 8.8l3.3-2.7Z" />
        <path d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2 10 10 0 0 0 2.9 7.6l3.3 2.7C7 7.9 9.3 6.1 12 6.1Z" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    home: (
      <>
        <path d="M3 11 12 3l9 8" />
        <path d="M5 10v10h14V10" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M17 8l-5-5-5 5" />
        <path d="M12 3v12" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </>
    )
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name] || icons.box}
    </svg>
  );
}

function toNumber(value) {
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(toNumber(value));
}

function calculateGain(item) {
  return toNumber(item.estimatedValue) - toNumber(item.purchasePrice);
}

function makeSavedItem(item, itemPhotos = [], receiptPhotos = []) {
  const itemPhotoList = Array.isArray(itemPhotos) ? itemPhotos : [];
  const receiptPhotoList = Array.isArray(receiptPhotos) ? receiptPhotos : [];
  const itemPhotoCount = Array.isArray(itemPhotos) ? itemPhotos.length : Number(itemPhotos || 0);
  const receiptPhotoCount = Array.isArray(receiptPhotos) ? receiptPhotos.length : Number(receiptPhotos || 0);

  return {
    id: `${item.name || "Untitled"}-${Date.now()}-${Math.random()}`,
    ...item,
    itemPhotoCount,
    receiptPhotoCount,
    itemPhotos: itemPhotoList.map((photo) => ({ ...photo })),
    receiptPhotos: receiptPhotoList.map((photo) => ({ ...photo })),
    savedAt: new Date().toISOString()
  };
}

function getActiveInventory(inventory) {
  return inventory.filter((entry) => entry.status !== "Sold");
}

function toDbItem(item, userId, itemPhotoCount = 0, receiptPhotoCount = 0) {
  return {
    user_id: userId,
    name: item.name || "",
    category: item.category || "Other",
    maker: item.maker || "",
    edition: item.edition || "",
    status: item.status || "Owned",
    purchase_date: item.purchaseDate || null,
    source: item.source || "",
    purchase_price: toNumber(item.purchasePrice),
    estimated_value: toNumber(item.estimatedValue),
    notes: item.notes || "",
    item_photo_count: itemPhotoCount,
    receipt_photo_count: receiptPhotoCount
  };
}

function fromDbItem(row) {
  return {
    id: row.id,
    name: row.name || "",
    category: row.category || "Other",
    maker: row.maker || "",
    edition: row.edition || "",
    status: row.status || "Owned",
    purchaseDate: row.purchase_date || "",
    source: row.source || "",
    purchasePrice: String(row.purchase_price ?? ""),
    estimatedValue: String(row.estimated_value ?? ""),
    notes: row.notes || "",
    itemPhotoCount: row.item_photo_count || 0,
    receiptPhotoCount: row.receipt_photo_count || 0,
    itemPhotos: [],
    receiptPhotos: [],
    savedAt: row.created_at || row.updated_at || new Date().toISOString()
  };
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
  return stringValue;
}

function buildCsvTemplate() {
  const rows = [csvHeaders, ...csvTemplateRows];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseCsvInventory(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = headers.reduce((acc, header, index) => ({ ...acc, [header]: values[index] || "" }), {});
    return makeSavedItem({ ...emptyItem, ...row, status: row.status || "Owned" }, 0, 0);
  });
}

function pickMockAutofill(fileName, photoType) {
  const normalized = String(fileName || "").toLowerCase();
  if (photoType.toLowerCase().includes("receipt")) return mockAutofillOptions[0].data;
  const matched = mockAutofillOptions.find((option) => normalized.includes(option.match));
  return matched?.data || mockAutofillOptions[mockAutofillOptions.length - 1].data;
}

function runRuntimeTests() {
  const activeTestInventory = [{ status: "Owned" }, { status: "Sold" }, { status: "Researching" }];
  const parsedTemplate = parseCsvInventory(buildCsvTemplate());
  return [
    { name: "sample inventory includes three starter items", pass: sampleItems.length === 3 },
    { name: "cost basis parses dollars safely", pass: toNumber("$45.50") === 45.5 },
    { name: "gain calculates estimated value minus cost basis", pass: calculateGain({ estimatedValue: "100", purchasePrice: "40" }) === 60 },
    { name: "receipt photo prompts include receipt", pass: receiptPhotoPrompts.includes("Receipt") },
    { name: "statuses include sold state", pass: statuses.includes("Sold") },
    { name: "quick categories include books", pass: quickCategories.includes("Book") },
    { name: "empty item defaults to owned status", pass: emptyItem.status === "Owned" },
    { name: "sold items are excluded from active inventory", pass: getActiveInventory(activeTestInventory).length === 2 },
    { name: "csv template can be parsed into inventory rows", pass: parsedTemplate.length === 2 },
    { name: "mock receipt autofill returns purchase price", pass: pickMockAutofill("receipt.jpg", "quickReceipt").purchasePrice === "45" }
  ];
}

export default function FirstFinderApp() {
  const [activeView, setActiveView] = useState("home");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginMode, setLoginMode] = useState("password");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [item, setItem] = useState(sampleItems[0]);
  const [quickItem, setQuickItem] = useState({ ...emptyItem, purchaseDate: "2026-05-12" });
  const [inventory, setInventory] = useState([]);
  const [itemPhotos, setItemPhotos] = useState([]);
  const [receiptPhotos, setReceiptPhotos] = useState([]);
  const [quickItemPhotos, setQuickItemPhotos] = useState([]);
  const [quickReceiptPhotos, setQuickReceiptPhotos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [inventoryViewMode, setInventoryViewMode] = useState("cards");
  const [inventoryStatusView, setInventoryStatusView] = useState("active");
  const [editingItem, setEditingItem] = useState(null);
  const [autofillMessage, setAutofillMessage] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        console.error("Session lookup error:", error.message);
        return;
      }

      if (data.session) {
        setCurrentUser(data.session.user);
        setIsLoggedIn(true);
        setActiveView("dashboard");
        loadInventory(data.session.user.id);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
      setActiveView(session ? "dashboard" : "home");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const runtimeTests = useMemo(() => runRuntimeTests(), []);
  const passingTests = runtimeTests.filter((test) => test.pass).length;
  const activeInventory = useMemo(() => getActiveInventory(inventory), [inventory]);
  const soldInventory = useMemo(() => inventory.filter((entry) => entry.status === "Sold"), [inventory]);
  const visibleInventory = inventoryStatusView === "sold" ? soldInventory : activeInventory;

  const totalCostBasis = useMemo(() => activeInventory.reduce((sum, entry) => sum + toNumber(entry.purchasePrice), 0), [activeInventory]);
  const totalEstimatedValue = useMemo(() => activeInventory.reduce((sum, entry) => sum + toNumber(entry.estimatedValue), 0), [activeInventory]);
  const totalGain = totalEstimatedValue - totalCostBasis;

  const viewTotalCostBasis = useMemo(() => visibleInventory.reduce((sum, entry) => sum + toNumber(entry.purchasePrice), 0), [visibleInventory]);
  const viewTotalEstimatedValue = useMemo(() => visibleInventory.reduce((sum, entry) => sum + toNumber(entry.estimatedValue), 0), [visibleInventory]);
  const viewTotalGain = viewTotalEstimatedValue - viewTotalCostBasis;

  const filteredInventory = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return visibleInventory;
    return visibleInventory.filter((entry) => [entry.name, entry.category, entry.maker, entry.source, entry.status].join(" ").toLowerCase().includes(query));
  }, [visibleInventory, searchTerm]);

  async function loadInventory(userId) {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load inventory error:", error.message);
      alert(error.message);
      return;
    }

    setInventory((data || []).map(fromDbItem));
  }

  function navigate(view) {
    if (!isLoggedIn && ["dashboard", "add", "inventory"].includes(view)) {
      setActiveView("login");
      return;
    }
    setActiveView(view);
  }

  async function handleGoogleLogin() {
    setLoginMode("google");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      console.error("Google login error:", error.message);
      alert(error.message);
    }
  }

  async function handlePasswordLogin(event) {
    event.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password
    });

    if (error) {
      console.error("Password login error:", error.message);
      alert(error.message);
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error.message);
      alert(error.message);
      return;
    }

    setCurrentUser(null);
    setInventory([]);
    setIsLoggedIn(false);
    setActiveView("home");
  }

  function loadSample(sample) {
    clearPhotoUrls(itemPhotos);
    clearPhotoUrls(receiptPhotos);
    setItem(sample);
    setItemPhotos([]);
    setReceiptPhotos([]);
    setActiveView("add");
  }

  function resetFullForm() {
    clearPhotoUrls(itemPhotos);
    clearPhotoUrls(receiptPhotos);
    setItem({ ...emptyItem });
    setItemPhotos([]);
    setReceiptPhotos([]);
  }

  function applyAutofill(fileName, photoType) {
    const inferred = pickMockAutofill(fileName, photoType);
    if (photoType.startsWith("quick")) {
      setQuickItem((current) => ({ ...current, ...inferred, name: current.name || inferred.name }));
    } else {
      setItem((current) => ({ ...current, ...inferred, name: current.name || inferred.name }));
    }
    setAutofillMessage(`Autofilled fields from ${fileName || "uploaded photo"}. Review before saving.`);
  }

  function handlePhotoUpload(event, photoType, shouldAutofill = false) {
    const files = Array.from(event.target.files || []);
    const nextPhotos = files.map((file) => ({
      id: `${photoType}-${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type || "image"
    }));

    if (photoType === "item") setItemPhotos((photos) => [...photos, ...nextPhotos]);
    if (photoType === "receipt") setReceiptPhotos((photos) => [...photos, ...nextPhotos]);
    if (photoType === "quickItem") setQuickItemPhotos((photos) => [...photos, ...nextPhotos]);
    if (photoType === "quickReceipt") setQuickReceiptPhotos((photos) => [...photos, ...nextPhotos]);
    if (shouldAutofill && files[0]) applyAutofill(files[0].name, photoType);
    event.target.value = "";
  }

  function removePhoto(id, photoType) {
    const setterMap = { item: setItemPhotos, receipt: setReceiptPhotos, quickItem: setQuickItemPhotos, quickReceipt: setQuickReceiptPhotos };
    const setter = setterMap[photoType];
    setter((photos) => {
      const photo = photos.find((entry) => entry.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return photos.filter((entry) => entry.id !== id);
    });
  }

  async function saveItem() {
    if (!currentUser) {
      alert("Please log in before saving inventory.");
      return;
    }

    const { data, error } = await supabase
      .from("inventory_items")
      .insert(toDbItem(item, currentUser.id, itemPhotos.length, receiptPhotos.length))
      .select()
      .single();

    if (error) {
      console.error("Save item error:", error.message);
      alert(error.message);
      return;
    }

    setInventory((items) => [fromDbItem(data), ...items]);
    setItem({ ...emptyItem });
    setItemPhotos([]);
    setReceiptPhotos([]);
    setActiveView("inventory");
  }

  async function saveQuickItem(event) {
    event.preventDefault();

    if (!currentUser) {
      alert("Please log in before saving inventory.");
      return;
    }

    const { data, error } = await supabase
      .from("inventory_items")
      .insert(toDbItem(quickItem, currentUser.id, quickItemPhotos.length, quickReceiptPhotos.length))
      .select()
      .single();

    if (error) {
      console.error("Save quick item error:", error.message);
      alert(error.message);
      return;
    }

    setInventory((items) => [fromDbItem(data), ...items]);
    setQuickItem({ ...emptyItem, purchaseDate: "2026-05-12" });
    setQuickItemPhotos([]);
    setQuickReceiptPhotos([]);
    setAutofillMessage("");
    setActiveView("inventory");
  }

  async function deleteItem(id) {
    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete item error:", error.message);
      alert(error.message);
      return;
    }

    setInventory((items) => items.filter((entry) => entry.id !== id));
  }

  async function markSold(id) {
    const { data, error } = await supabase
      .from("inventory_items")
      .update({ status: "Sold", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Mark sold error:", error.message);
      alert(error.message);
      return;
    }

    setInventory((items) => items.map((entry) => (entry.id === id ? fromDbItem(data) : entry)));
  }

  async function restoreSold(id) {
    const { data, error } = await supabase
      .from("inventory_items")
      .update({ status: "Owned", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Restore item error:", error.message);
      alert(error.message);
      return;
    }

    setInventory((items) => items.map((entry) => (entry.id === id ? fromDbItem(data) : entry)));
    setInventoryStatusView("active");
  }

  async function updateInventoryItem(updatedItem) {
    const { data, error } = await supabase
      .from("inventory_items")
      .update({
        name: updatedItem.name || "",
        category: updatedItem.category || "Other",
        maker: updatedItem.maker || "",
        edition: updatedItem.edition || "",
        status: updatedItem.status || "Owned",
        purchase_date: updatedItem.purchaseDate || null,
        source: updatedItem.source || "",
        purchase_price: toNumber(updatedItem.purchasePrice),
        estimated_value: toNumber(updatedItem.estimatedValue),
        notes: updatedItem.notes || "",
        updated_at: new Date().toISOString()
      })
      .eq("id", updatedItem.id)
      .select()
      .single();

    if (error) {
      console.error("Update item error:", error.message);
      alert(error.message);
      return;
    }

    setInventory((items) => items.map((entry) => (entry.id === updatedItem.id ? fromDbItem(data) : entry)));
    setEditingItem(null);
  }

  function downloadTemplate() {
    const csv = buildCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "firstfinder-inventory-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleBulkUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      if (!currentUser) {
        alert("Please log in before importing inventory.");
        return;
      }

      const importedItems = parseCsvInventory(String(reader.result || ""));
      const rows = importedItems.map((entry) => toDbItem(entry, currentUser.id, 0, 0));

      const { data, error } = await supabase
        .from("inventory_items")
        .insert(rows)
        .select();

      if (error) {
        console.error("Bulk import error:", error.message);
        alert(error.message);
        return;
      }

      setInventory((items) => [...(data || []).map(fromDbItem), ...items]);
      setBulkMessage(`Imported ${(data || []).length} item${(data || []).length === 1 ? "" : "s"} from ${file.name}.`);
      setActiveView("inventory");
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <main className="min-h-screen bg-[#f6efe3] text-[#201a14]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <button onClick={() => navigate(isLoggedIn ? "dashboard" : "home")} className="flex items-center gap-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#123f38] text-[#fff7ea]"><Icon name="box" size={21} /></div>
          <div><div className="text-xl font-semibold tracking-tight">FirstFinder</div><div className="text-xs uppercase tracking-[0.22em] text-[#746655]">Collectible inventory</div></div>
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-[#d8c7ad] bg-[#fff8ee] p-1 md:flex">
          {isLoggedIn && <TabButton active={activeView === "dashboard"} onClick={() => setActiveView("dashboard")}>Add Inventory</TabButton>}
          {isLoggedIn && <TabButton active={activeView === "inventory"} onClick={() => setActiveView("inventory")}>View Inventory ({activeInventory.length})</TabButton>}
          {isLoggedIn && <TabButton active={activeView === "add"} onClick={() => setActiveView("add")}>Tutorial</TabButton>}
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn ? <Button variant="outline" onClick={logout} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">Log out</Button> : <Button onClick={() => setActiveView("login")} className="rounded-full bg-[#123f38] px-5 text-[#fff7ea] hover:bg-[#0f332d]">Log in</Button>}
        </div>
      </nav>

      {activeView === "home" && <HomePage onGetStarted={() => setActiveView(isLoggedIn ? "dashboard" : "login")} />}
      {activeView === "login" && <LoginPage loginMode={loginMode} setLoginMode={setLoginMode} loginForm={loginForm} setLoginForm={setLoginForm} onGoogleLogin={handleGoogleLogin} onPasswordLogin={handlePasswordLogin} />}
      {activeView === "dashboard" && isLoggedIn && <DashboardPage quickItem={quickItem} setQuickItem={setQuickItem} quickItemPhotos={quickItemPhotos} quickReceiptPhotos={quickReceiptPhotos} onUpload={handlePhotoUpload} onRemove={removePhoto} onSave={saveQuickItem} onFullAdd={() => setActiveView("add")} onInventory={() => setActiveView("inventory")} inventory={activeInventory} totalCostBasis={totalCostBasis} totalEstimatedValue={totalEstimatedValue} totalGain={totalGain} autofillMessage={autofillMessage} onDownloadTemplate={downloadTemplate} onBulkUpload={handleBulkUpload} bulkMessage={bulkMessage} />}
      {activeView === "add" && isLoggedIn && <FullAddPage item={item} setItem={setItem} itemPhotos={itemPhotos} receiptPhotos={receiptPhotos} onUpload={handlePhotoUpload} onRemove={removePhoto} onSave={saveItem} onReset={resetFullForm} onLoadSample={loadSample} autofillMessage={autofillMessage} />}
      {activeView === "inventory" && isLoggedIn && <InventoryPage inventory={visibleInventory} filteredInventory={filteredInventory} searchTerm={searchTerm} setSearchTerm={setSearchTerm} viewMode={inventoryViewMode} setViewMode={setInventoryViewMode} statusView={inventoryStatusView} setStatusView={setInventoryStatusView} activeCount={activeInventory.length} soldCount={soldInventory.length} totalCostBasis={viewTotalCostBasis} totalEstimatedValue={viewTotalEstimatedValue} totalGain={viewTotalGain} onAdd={() => setActiveView("dashboard")} onDelete={deleteItem} onMarkSold={markSold} onRestoreSold={restoreSold} onEdit={setEditingItem} bulkMessage={bulkMessage} />}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={updateInventoryItem}
        />
      )}

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mt-6 rounded-[2rem] border border-[#d8c7ad] bg-[#fff8ee] p-5">
          <div className="mb-3 flex items-center justify-between gap-4"><div className="font-semibold">Prototype checks</div><div className="text-sm text-[#665746]">{passingTests}/{runtimeTests.length} passing</div></div>
          <div className="grid gap-2 md:grid-cols-2">{runtimeTests.map((test) => <div key={test.name} className="flex items-center gap-2 text-sm text-[#665746]"><span className={`h-2.5 w-2.5 rounded-full ${test.pass ? "bg-[#123f38]" : "bg-red-700"}`} />{test.name}</div>)}</div>
        </div>
      </section>
    </main>
  );
}

function HomePage({ onGetStarted }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div className="grid gap-12 md:grid-cols-[1fr_0.9fr] md:items-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-sm text-[#655644]"><Icon name="receipt" size={16} /> Receipts, values, photos, proof</div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-tight md:text-7xl">Inventory collectibles like you may actually sell them one day.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#665746]">FirstFinder helps collectors keep item photos, receipt photos, purchase details, value estimates, and sale status in one clean place.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button onClick={onGetStarted} className="h-12 rounded-full bg-[#123f38] px-7 text-base text-[#fff7ea] hover:bg-[#0f332d]">Get Started <Icon name="arrow" size={18} className="ml-1" /></Button></div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl"><CardContent className="p-7"><div className="rounded-[1.5rem] bg-[#123f38] p-6 text-[#fff7ea]"><div className="text-sm uppercase tracking-[0.2em] text-[#d8e6e2]">Your records</div><div className="mt-4 grid gap-3"><HomeFeature icon="camera" title="Item photos" text="Condition, edition points, signatures, defects, tags, and packaging." /><HomeFeature icon="receipt" title="Receipt proof" text="Receipts, invoices, auction records, and order confirmations." /><HomeFeature icon="dollar" title="Cost basis" text="Track what you paid, what it may be worth, and what changed when sold." /></div></div></CardContent></Card>
        </motion.div>
      </div>
    </section>
  );
}

function LoginPage({ loginMode, setLoginMode, loginForm, setLoginForm, onGoogleLogin, onPasswordLogin }) {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-[0.9fr_1.1fr] md:items-start">
      <div>
        <h1 className="text-5xl font-semibold tracking-tight">Log in to your collection.</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-[#665746]">
          Sign in with Google or use your email and password to access your collectible inventory.
        </p>
      </div>

      <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl">
        <CardContent className="p-7">
          <div className="mb-6 grid grid-cols-2 rounded-full border border-[#d8c7ad] bg-[#fff8ee] p-1">
            <TabButton active={loginMode === "password"} onClick={() => setLoginMode("password")}>Email</TabButton>
            <TabButton active={loginMode === "google"} onClick={() => setLoginMode("google")}>Google</TabButton>
          </div>

          {loginMode === "google" ? (
            <div>
              <h2 className="text-2xl font-semibold">Continue with Google</h2>
              <p className="mt-3 leading-7 text-[#665746]">
                Continue with your Google account to access your collection.
              </p>
              <button
                type="button"
                onClick={onGoogleLogin}
                className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#cdbb9c] bg-white px-6 text-base font-semibold text-[#123f38] shadow-sm transition hover:bg-[#f8f4ec] hover:shadow-md active:scale-[0.99]"
              >
                <Icon name="google" size={20} />
                <span>Continue with Google</span>
              </button>
            </div>
          ) : (
            <form onSubmit={onPasswordLogin}>
              <h2 className="text-2xl font-semibold">Email and password</h2>
              <p className="mt-3 leading-7 text-[#665746]">
                Log in with the email and password connected to your Supabase account.
              </p>
              <div className="mt-6 grid gap-4">
                <Field label="Email" type="email" value={loginForm.email} onChange={(value) => setLoginForm({ ...loginForm, email: value })} />
                <Field label="Password" type="password" value={loginForm.password} onChange={(value) => setLoginForm({ ...loginForm, password: value })} />
              </div>
              <Button type="submit" className="mt-6 h-12 w-full rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
                Log in
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function DashboardPage({ quickItem, setQuickItem, quickItemPhotos, quickReceiptPhotos, onUpload, onRemove, onSave, onFullAdd, onInventory, inventory, totalCostBasis, totalGain, autofillMessage, onDownloadTemplate, onBulkUpload, bulkMessage }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-sm text-[#655644]"><Icon name="home" size={16} /> Add Inventory</div>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight">Add something quickly.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665746]">Use quick add for most items. Upload a photo to mock-autofill fields, use CSV for bulk import, or open the tutorial for the guided flow.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onInventory} className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">View Inventory</Button>
          <Button onClick={onFullAdd} variant="outline" className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">Tutorial</Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <DashboardCard icon="box" label="Active inventory" value={inventory.length} />
        <DashboardCard icon="receipt" label="Cost basis" value={formatCurrency(totalCostBasis)} />
        <DashboardCard icon="dollar" label="Est. gain/loss" value={formatCurrency(totalGain)} />
      </div>

      <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl">
        <CardContent className="p-6 md:p-8">
          <form onSubmit={onSave}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Quick add</div>
                <h2 className="mt-1 text-3xl font-semibold">New collectible</h2>
              </div>
              <Button type="submit" className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]"><Icon name="save" size={17} className="mr-2" /> Save</Button>
            </div>

            {autofillMessage && <div className="mt-5 rounded-2xl bg-[#edf4f2] p-4 text-sm leading-6 text-[#123f38]">{autofillMessage}</div>}

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <Field label="Item name" value={quickItem.name} onChange={(value) => setQuickItem({ ...quickItem, name: value })} />
              <SelectField label="Category" value={quickItem.category} options={quickCategories} onChange={(value) => setQuickItem({ ...quickItem, category: value })} />
              <Field label="Cost basis" type="number" value={quickItem.purchasePrice} onChange={(value) => setQuickItem({ ...quickItem, purchasePrice: value })} />
              <Field label="Estimated value" type="number" value={quickItem.estimatedValue} onChange={(value) => setQuickItem({ ...quickItem, estimatedValue: value })} />
              <Field label="Maker / Author / Brand" value={quickItem.maker} onChange={(value) => setQuickItem({ ...quickItem, maker: value })} />
              <Field label="Where purchased" value={quickItem.source} onChange={(value) => setQuickItem({ ...quickItem, source: value })} />
              <Field label="Purchase date" type="date" value={quickItem.purchaseDate} onChange={(value) => setQuickItem({ ...quickItem, purchaseDate: value })} />
              <SelectField label="Status" value={quickItem.status} options={statuses} onChange={(value) => setQuickItem({ ...quickItem, status: value })} />
            </div>

            <div className="mt-5">
              <Field label="Notes" value={quickItem.notes} onChange={(value) => setQuickItem({ ...quickItem, notes: value })} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <CompactUploader title="Item photo + autofill" icon="camera" photos={quickItemPhotos} onUpload={(event) => onUpload(event, "quickItem", true)} onRemove={(id) => onRemove(id, "quickItem")} />
              <CompactUploader title="Receipt proof + autofill" icon="receipt" photos={quickReceiptPhotos} onUpload={(event) => onUpload(event, "quickReceipt", true)} onRemove={(id) => onRemove(id, "quickReceipt")} />
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8">
        <BulkUploadCard onDownloadTemplate={onDownloadTemplate} onBulkUpload={onBulkUpload} bulkMessage={bulkMessage} />
      </div>
    </section>
  );
}

function FullAddPage({ item, setItem, itemPhotos, receiptPhotos, onUpload, onRemove, onSave, onReset, onLoadSample, autofillMessage }) {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[0.82fr_1.18fr] lg:py-16">
      <div><motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-sm text-[#655644]"><Icon name="plus" size={16} /> Tutorial</div><h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-tight md:text-6xl">Add the complete record.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[#665746]">Use this guided tutorial when you want to capture every field, item photo, and receipt/proof image before saving.</p></motion.div><Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm"><CardContent className="p-6"><h2 className="text-xl font-semibold">Try a sample</h2><div className="mt-4 grid gap-3">{sampleItems.map((sample) => <button key={sample.name} onClick={() => onLoadSample(sample)} className={`rounded-2xl border p-4 text-left transition hover:bg-white ${item.name === sample.name ? "border-[#123f38] bg-white" : "border-[#e0d2bc] bg-[#f8f0e4]"}`}><div className="font-semibold">{sample.name}</div><div className="text-sm text-[#665746]">{sample.category} · {sample.source}</div></button>)}</div></CardContent></Card></div>
      <div className="space-y-5"><Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Step 1</div><h2 className="mt-1 text-2xl font-semibold">Item record</h2></div><div className="rounded-full bg-[#edf4f2] px-3 py-1 text-sm font-medium text-[#123f38]">Detailed</div></div>{autofillMessage && <div className="mt-5 rounded-2xl bg-[#edf4f2] p-4 text-sm leading-6 text-[#123f38]">{autofillMessage}</div>}<div className="mt-5 grid gap-3 md:grid-cols-2"><Field label="Item name" value={item.name} onChange={(value) => setItem({ ...item, name: value })} /><Field label="Category" value={item.category} onChange={(value) => setItem({ ...item, category: value })} /><Field label="Maker / Author / Brand" value={item.maker} onChange={(value) => setItem({ ...item, maker: value })} /><Field label="Edition / Variant / Details" value={item.edition} onChange={(value) => setItem({ ...item, edition: value })} /><SelectField label="Status" value={item.status} options={statuses} onChange={(value) => setItem({ ...item, status: value })} /><Field label="Purchase date" type="date" value={item.purchaseDate} onChange={(value) => setItem({ ...item, purchaseDate: value })} /><Field label="Where purchased" value={item.source} onChange={(value) => setItem({ ...item, source: value })} /><Field label="Cost basis / purchase price" type="number" value={item.purchasePrice} onChange={(value) => setItem({ ...item, purchasePrice: value })} /><Field label="Estimated value" type="number" value={item.estimatedValue} onChange={(value) => setItem({ ...item, estimatedValue: value })} /><Field label="Notes" value={item.notes} onChange={(value) => setItem({ ...item, notes: value })} /></div></CardContent></Card><div className="grid gap-5 md:grid-cols-2"><PhotoUploader title="Item photos + autofill" eyebrow="Step 2" description="Capture condition, edition points, signatures, defects, tags, labels, or packaging. The first uploaded image can mock-autofill fields." prompts={itemPhotoPrompts} photos={itemPhotos} onUpload={(event) => onUpload(event, "item", true)} onRemove={(id) => onRemove(id, "item")} /><PhotoUploader title="Receipt / proof photos + autofill" eyebrow="Step 3" description="Save receipts, invoices, order confirmations, auction records, or payment screenshots. Receipt uploads can mock-autofill cost basis." prompts={receiptPhotoPrompts} photos={receiptPhotos} onUpload={(event) => onUpload(event, "receipt", true)} onRemove={(id) => onRemove(id, "receipt")} /></div><Card className="rounded-[2rem] border-[#d8c7ad] bg-white shadow-xl"><CardContent className="p-6"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Step 4</div><h2 className="mt-1 text-3xl font-semibold">Review and save</h2><p className="mt-3 max-w-xl leading-7 text-[#665746]">{item.name || "This item"} has a cost basis of {formatCurrency(item.purchasePrice)} and an estimated value of {formatCurrency(item.estimatedValue)}. Current estimated gain/loss is {formatCurrency(calculateGain(item))}.</p></div><div className="rounded-3xl bg-[#f7efe3] p-5 text-center"><div className="text-3xl font-semibold text-[#123f38]">{formatCurrency(calculateGain(item))}</div><div className="mt-1 text-sm text-[#665746]">est. gain/loss</div></div></div><div className="mt-6 grid gap-3 md:grid-cols-3"><SummaryPill label="Item photos" value={itemPhotos.length} /><SummaryPill label="Receipt photos" value={receiptPhotos.length} /><SummaryPill label="Status" value={item.status} /></div>{receiptPhotos.length === 0 && <div className="mt-5 rounded-2xl bg-[#fff3d8] p-4 text-sm leading-6 text-[#6d5526]">Add a receipt or proof photo if you want documentation for cost basis later.</div>}<div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button onClick={onSave} className="h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]"><Icon name="save" size={17} className="mr-2" /> Save to inventory</Button><Button variant="outline" onClick={onReset} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">Reset form</Button></div></CardContent></Card></div>
    </section>
  );
}

function InventoryPage({ inventory, filteredInventory, searchTerm, setSearchTerm, viewMode, setViewMode, statusView, setStatusView, activeCount, soldCount, totalCostBasis, totalEstimatedValue, totalGain, onAdd, onDelete, onMarkSold, onRestoreSold, onEdit, bulkMessage }) {
  const [photoViewer, setPhotoViewer] = useState(null);

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-sm text-[#655644]"><Icon name="box" size={16} /> View Inventory</div>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight">{statusView === "sold" ? "Sold collectibles" : "Your active collectibles"}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665746]">
            {statusView === "sold"
              ? "Sold items stay preserved here for reporting, resale history, and cost-basis records."
              : "Sold items are removed from active inventory counts and moved into the Sold tab."}
          </p>
        </div>
        <Button onClick={onAdd} className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">Add inventory</Button>
      </div>

      {bulkMessage && <div className="mt-6 rounded-2xl bg-[#edf4f2] p-4 text-sm leading-6 text-[#123f38]">{bulkMessage}</div>}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <DashboardCard icon="receipt" label="Active cost basis" value={formatCurrency(totalCostBasis)} />
        <DashboardCard icon="dollar" label="Active estimated value" value={formatCurrency(totalEstimatedValue)} />
        <DashboardCard icon="search" label="Active est. gain/loss" value={formatCurrency(totalGain)} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-[#d8c7ad] bg-[#fff8ee] p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3">
            <Icon name="search" size={18} className="text-[#746655]" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by item, category, maker, source, or status..." className="w-full bg-transparent outline-none" />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-[#d8c7ad] bg-[#fff8ee] p-1">
          <TabButton active={viewMode === "cards"} onClick={() => setViewMode("cards")}>Cards</TabButton>
          <TabButton active={viewMode === "records"} onClick={() => setViewMode("records")}>Records</TabButton>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-[2rem] border border-[#d8c7ad] bg-[#fff8ee] p-2">
        <div className="text-sm text-[#665746]">
          Showing {statusView === "sold" ? "sold records" : "active inventory"}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#d8c7ad] bg-[#fff8ee] p-1">
          <TabButton active={statusView === "active"} onClick={() => setStatusView("active")}>Active ({activeCount})</TabButton>
          <TabButton active={statusView === "sold"} onClick={() => setStatusView("sold")}>Sold ({soldCount})</TabButton>
        </div>
      </div>

      {inventory.length === 0 ? (
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#123f38] text-[#fff7ea]"><Icon name="receipt" size={26} /></div>
            <h2 className="mt-5 text-2xl font-semibold">No active inventory</h2>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#665746]">Add an item or import a CSV to start building your cost-basis record.</p>
          </CardContent>
        </Card>
      ) : filteredInventory.length === 0 ? (
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <CardContent className="p-8 text-center"><h2 className="text-2xl font-semibold">No matches</h2><p className="mt-3 text-[#665746]">Try a different search term.</p></CardContent>
        </Card>
      ) : viewMode === "records" ? (
        <div className="mt-8 overflow-hidden rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#f0e2cf] text-xs uppercase tracking-[0.14em] text-[#665746]">
                <tr>
                  <th className="px-5 py-4">Item</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Cost</th>
                  <th className="px-5 py-4">Value</th>
                  <th className="px-5 py-4">Photos</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((entry) => (
                  <tr key={entry.id} className="border-t border-[#e0d2bc]">
                    <td className="px-5 py-4"><div className="font-semibold">{entry.name || "Untitled item"}</div><div className="text-[#665746]">{entry.maker || "Unknown maker"}</div></td>
                    <td className="px-5 py-4">{entry.category}</td>
                    <td className="px-5 py-4">{entry.status}</td>
                    <td className="px-5 py-4">{formatCurrency(entry.purchasePrice)}</td>
                    <td className="px-5 py-4">{formatCurrency(entry.estimatedValue)}</td>
                    <td className="px-5 py-4">
                      <button type="button" onClick={() => setPhotoViewer(entry)} className="rounded-full bg-[#edf4f2] px-3 py-1 text-xs font-medium text-[#123f38]">
                        View {(entry.itemPhotoCount || 0) + (entry.receiptPhotoCount || 0)}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onEdit(entry)} className="px-4 py-2">Edit</Button>
                        {entry.status === "Sold" ? (
                          <Button variant="outline" onClick={() => onRestoreSold(entry.id)} className="px-4 py-2">Restore</Button>
                        ) : (
                          <Button variant="outline" onClick={() => onMarkSold(entry.id)} className="px-4 py-2">Sold</Button>
                        )}
                        <button onClick={() => onDelete(entry.id)} className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf]" aria-label={`Delete ${entry.name || "inventory item"}`}><Icon name="trash" size={17} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {filteredInventory.map((entry) => (
            <Card key={entry.id} className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#edf4f2] px-3 py-1 text-xs font-medium text-[#123f38]">{entry.status}</span>
                      <span className="rounded-full bg-[#f0e2cf] px-3 py-1 text-xs font-medium text-[#665746]">{entry.category}</span>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold">{entry.name || "Untitled item"}</h2>
                    <p className="text-[#665746]">{entry.maker || "Unknown maker"}</p>
                  </div>
                  <button onClick={() => onDelete(entry.id)} className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf]" aria-label={`Delete ${entry.name || "inventory item"}`}><Icon name="trash" size={17} /></button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <SmallMetric label="Cost" value={formatCurrency(entry.purchasePrice)} />
                  <SmallMetric label="Value" value={formatCurrency(entry.estimatedValue)} />
                  <SmallMetric label="Gain" value={formatCurrency(calculateGain(entry))} />
                </div>

                <div className="mt-5 rounded-2xl bg-white p-4">
                  <div className="text-sm leading-6 text-[#665746]">{entry.edition || "No edition details"} · Purchased from {entry.source || "unknown source"} on {entry.purchaseDate || "unknown date"}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <button type="button" onClick={() => setPhotoViewer(entry)} className={`rounded-full px-3 py-1 ${entry.receiptPhotoCount > 0 ? "bg-[#edf4f2] text-[#123f38]" : "bg-[#fff3d8] text-[#6d5526]"}`}>
                      {entry.receiptPhotoCount > 0 ? `${entry.receiptPhotoCount} receipt proof` : "No receipt proof"}
                    </button>
                    <button type="button" onClick={() => setPhotoViewer(entry)} className="rounded-full bg-[#f0e2cf] px-3 py-1 text-[#665746]">
                      {entry.itemPhotoCount || 0} item photo{entry.itemPhotoCount === 1 ? "" : "s"}
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-[#665746]">{entry.notes}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => onEdit(entry)} className="h-10 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">Edit</Button>
                  {entry.status === "Sold" ? (
                    <Button variant="outline" onClick={() => onRestoreSold(entry.id)} className="h-10 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">Restore to active</Button>
                  ) : (
                    <Button variant="outline" onClick={() => onMarkSold(entry.id)} className="h-10 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">Mark sold</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {photoViewer && <PhotoViewerModal entry={photoViewer} onClose={() => setPhotoViewer(null)} />}
    </section>
  );
}

function BulkUploadCard({ onDownloadTemplate, onBulkUpload, bulkMessage }) {
  return (
    <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm"><CardContent className="p-6"><div className="inline-flex items-center gap-2 rounded-full bg-[#edf4f2] px-3 py-1 text-sm font-medium text-[#123f38]"><Icon name="file" size={15} /> Bulk upload</div><h2 className="mt-4 text-2xl font-semibold">Import inventory by CSV.</h2><p className="mt-3 leading-7 text-[#665746]">Download the template, fill it out, then upload it here. Photos can be added later item-by-item.</p><div className="mt-5 grid gap-3"><Button type="button" onClick={onDownloadTemplate} variant="outline" className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white"><Icon name="file" size={17} className="mr-2" /> Download CSV template</Button><label className="flex h-11 cursor-pointer items-center justify-center rounded-full bg-[#123f38] px-5 font-medium text-[#fff7ea] hover:bg-[#0f332d]"><Icon name="upload" size={17} className="mr-2" /> Upload CSV<input type="file" accept=".csv,text/csv" onChange={onBulkUpload} className="hidden" /></label></div>{bulkMessage && <div className="mt-5 rounded-2xl bg-[#edf4f2] p-4 text-sm leading-6 text-[#123f38]">{bulkMessage}</div>}<div className="mt-5 rounded-2xl bg-[#f7efe3] p-4 text-xs leading-6 text-[#665746]"><div className="font-semibold">Template columns</div><div className="mt-1 break-words">{csvHeaders.join(", ")}</div></div></CardContent></Card>
  );
}

function EditItemModal({ item, onClose, onSave }) {
  const [draft, setDraft] = useState({ ...item });

  function handleSubmit(event) {
    event.preventDefault();
    onSave(draft);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-[#fff9f0] p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Edit record</div>
            <h2 className="mt-1 text-3xl font-semibold">{item.name || "Untitled item"}</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf]" aria-label="Close edit modal">
            <Icon name="x" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Item name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
            <SelectField label="Category" value={draft.category} options={quickCategories} onChange={(value) => setDraft({ ...draft, category: value })} />
            <Field label="Maker / Author / Brand" value={draft.maker} onChange={(value) => setDraft({ ...draft, maker: value })} />
            <Field label="Edition / Variant / Details" value={draft.edition} onChange={(value) => setDraft({ ...draft, edition: value })} />
            <SelectField label="Status" value={draft.status} options={statuses} onChange={(value) => setDraft({ ...draft, status: value })} />
            <Field label="Purchase date" type="date" value={draft.purchaseDate} onChange={(value) => setDraft({ ...draft, purchaseDate: value })} />
            <Field label="Where purchased" value={draft.source} onChange={(value) => setDraft({ ...draft, source: value })} />
            <Field label="Cost basis" type="number" value={draft.purchasePrice} onChange={(value) => setDraft({ ...draft, purchasePrice: value })} />
            <Field label="Estimated value" type="number" value={draft.estimatedValue} onChange={(value) => setDraft({ ...draft, estimatedValue: value })} />
            <Field label="Notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">
              Cancel
            </Button>
            <Button type="submit" className="h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PhotoViewerModal({ entry, onClose }) {
  const itemPhotos = entry.itemPhotos || [];
  const receiptPhotos = entry.receiptPhotos || [];
  const allPhotos = [
    ...itemPhotos.map((photo) => ({ ...photo, label: "Item photo" })),
    ...receiptPhotos.map((photo) => ({ ...photo, label: "Receipt proof" }))
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-[#fff9f0] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Photos</div>
            <h2 className="mt-1 text-3xl font-semibold">{entry.name || "Untitled item"}</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf]" aria-label="Close photo viewer">
            <Icon name="x" size={18} />
          </button>
        </div>

        {allPhotos.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-[#f7efe3] p-6 text-center text-[#665746]">
            No saved photos for this item yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {allPhotos.map((photo) => (
              <div key={photo.id} className="overflow-hidden rounded-2xl border border-[#d8c7ad] bg-white">
                <img src={photo.url} alt={photo.name} className="h-72 w-full object-cover" />
                <div className="p-4">
                  <div className="font-semibold">{photo.label}</div>
                  <div className="truncate text-sm text-[#665746]">{photo.name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function clearPhotoUrls(photos) { photos.forEach((photo) => URL.revokeObjectURL(photo.url)); }
function HomeFeature({ icon, title, text }) { return <div className="rounded-2xl bg-white/10 p-4"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><Icon name={icon} size={19} /></div><div className="font-semibold">{title}</div><div className="mt-1 text-sm leading-6 text-[#dce7e4]">{text}</div></div>; }
function TabButton({ active, children, onClick }) { return <button onClick={onClick} className={`rounded-full px-4 py-2 text-sm font-medium transition ${active ? "bg-[#123f38] text-[#fff7ea]" : "text-[#665746] hover:bg-white"}`}>{children}</button>; }
function Field({ label, value, onChange, type = "text" }) { return <label className="block"><div className="mb-2 text-sm font-medium text-[#665746]">{label}</div><input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15" /></label>; }
function SelectField({ label, value, options, onChange }) { return <label className="block"><div className="mb-2 text-sm font-medium text-[#665746]">{label}</div><select value={value || ""} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function PhotoUploader({ title, eyebrow, description, prompts, photos, onUpload, onRemove }) { return <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">{eyebrow}</div><h2 className="mt-1 text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#665746]">{description}</p></div><div className="rounded-full bg-[#edf4f2] px-3 py-1 text-sm font-medium text-[#123f38]">{photos.length}</div></div><label className="mt-5 flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-[#cbb894] bg-[#f7ecdc] p-6 text-center transition hover:bg-[#fff4e6]"><Icon name={title.toLowerCase().includes("receipt") ? "receipt" : "camera"} size={36} className="text-[#123f38]" /><div className="mt-3 text-lg font-semibold">Take or upload</div><div className="mt-1 max-w-sm text-xs leading-5 text-[#6b5b4c]">Works with camera or photo library on mobile.</div><input type="file" accept="image/*" capture="environment" multiple onChange={onUpload} className="hidden" /></label><div className="mt-4 flex flex-wrap gap-2">{prompts.map((prompt) => <div key={prompt} className="rounded-full bg-[#f0e2cf] px-3 py-1 text-xs text-[#665746]">{prompt}</div>)}</div>{photos.length > 0 && <PhotoGrid photos={photos} onRemove={onRemove} />}</CardContent></Card>; }
function CompactUploader({ title, icon, photos, onUpload, onRemove }) { return <div className="rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] p-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 font-semibold"><Icon name={icon} size={17} /> {title}</div><span className="rounded-full bg-[#edf4f2] px-3 py-1 text-xs text-[#123f38]">{photos.length}</span></div><label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#cbb894] bg-[#f7ecdc] px-4 py-4 text-sm font-medium hover:bg-[#fff4e6]">Take or upload<input type="file" accept="image/*" capture="environment" multiple onChange={onUpload} className="hidden" /></label>{photos.length > 0 && <PhotoGrid photos={photos} onRemove={onRemove} compact />}</div>; }
function PhotoGrid({ photos, onRemove, compact = false }) { return <div className={`mt-4 grid gap-3 ${compact ? "grid-cols-3" : "sm:grid-cols-2"}`}>{photos.map((photo) => <div key={photo.id} className="group relative overflow-hidden rounded-2xl border border-[#e0d2bc] bg-white shadow-sm"><img src={photo.url} alt={photo.name} className={`${compact ? "h-20" : "h-32"} w-full object-cover`} /><button type="button" onClick={() => onRemove(photo.id)} className="absolute right-2 top-2 rounded-full bg-[#201a14]/75 p-2 text-white opacity-100 transition hover:bg-[#201a14] sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Remove ${photo.name}`}><Icon name="x" size={15} /></button>{!compact && <div className="truncate px-3 py-2 text-xs text-[#665746]">{photo.name}</div>}</div>)}</div>; }
function SummaryPill({ label, value }) { return <div className="rounded-2xl bg-[#f7efe3] p-4"><div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>; }
function DashboardCard({ icon, label, value }) { return <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm"><CardContent className="flex items-center gap-4 p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#123f38] text-[#fff7ea]"><Icon name={icon} size={22} /></div><div><div className="text-sm text-[#665746]">{label}</div><div className="text-2xl font-semibold">{value}</div></div></CardContent></Card>; }
function SmallMetric({ label, value }) { return <div className="rounded-2xl bg-white p-4"><div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }

function Button({ children, variant = "primary", className = "", onClick, type = "button", disabled = false }) {
  const styles =
    variant === "outline"
      ? "border border-[#cdbb9d] bg-[#fff8ee] text-[#201a14] hover:bg-white"
      : "bg-[#123f38] text-[#fff7ea] hover:bg-[#0f332d]";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardContent({ children, className = "" }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}
