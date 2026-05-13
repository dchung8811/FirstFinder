"use client";

import React, { useMemo, useState } from "react";

const discoveryCards = [
  {
    title: "The Gunslinger",
    author: "Stephen King",
    edition: "1982 Donald M. Grant first edition",
    hook: "The copy Dark Tower collectors keep chasing — especially with a clean dust jacket.",
    detail: "Look for Grant, first printing points, jacket condition, and illustrator details.",
    price: "$5.8K est.",
    mood: "Cult fantasy",
    tags: ["Dust jacket", "Grant", "First printing"],
  },
  {
    title: "The Stand",
    author: "Stephen King",
    edition: "1978 Doubleday first edition",
    hook: "A meaningful shelf centerpiece for King collectors without jumping straight to five figures.",
    detail: "Check the R49 gutter code, jacket price, boards, and overall shelf wear.",
    price: "$950 est.",
    mood: "Modern horror",
    tags: ["R49 code", "Doubleday", "Under $1K"],
  },
  {
    title: "East of Eden",
    author: "John Steinbeck",
    edition: "1952 Viking first edition",
    hook: "For readers who want the emotional weight of the story in a collectible form.",
    detail: "Condition and dust jacket quality usually drive the difference between nice and special.",
    price: "$750+ est.",
    mood: "Literary classic",
    tags: ["Viking", "Family epic", "Giftable"],
  },
];

const savedWants = [
  "The exact copy I read in high school",
  "A signed modern horror book under $500",
  "Steinbeck first editions with strong jackets",
  "Stephen King true firsts I can actually afford",
];

const promptChips = [
  "I want the version of The Stand collectors actually care about",
  "Help me find a meaningful Steinbeck gift",
  "Show me rare sci-fi that still feels attainable",
];

const starterMessages = [
  {
    role: "assistant",
    text: "Start with the story, memory, author, budget, or exact edition you have in mind. I’ll help translate that into what to look for.",
  },
];

function matchDiscoveryCards(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return discoveryCards;

  return discoveryCards.filter((book) => {
    const text = `${book.title} ${book.author} ${book.edition} ${book.hook} ${book.detail} ${book.tags.join(" ")}`.toLowerCase();
    return normalized.split(/\s+/).some((term) => text.includes(term.replace(/[^a-z0-9]/g, "")));
  });
}

function getAssistantReply(message, matches) {
  if (matches.length === 0) {
    return "I’d start by turning that into a want-list profile: title or author, why it matters, max budget, condition tolerance, and whether a dust jacket or signature matters.";
  }

  const top = matches[0];
  return `I’d start with ${top.title}. The emotional fit is ${top.mood.toLowerCase()}, and the collector fit depends on ${top.tags.join(", ").toLowerCase()}.`;
}

export default function BookCollectorFinder() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState(starterMessages);

  const matches = useMemo(() => matchDiscoveryCards(query), [query]);

  function submitSearch(text = input) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const nextMatches = matchDiscoveryCards(trimmed);
    setQuery(trimmed);
    setInput("");
    setMessages((current) => [
      ...current,
      { role: "user", text: trimmed },
      { role: "assistant", text: getAssistantReply(trimmed, nextMatches) },
    ]);
  }

  return (
    <div className="min-h-screen bg-[#fbfaf7] text-stone-950">
      <div className="pointer-events-none fixed inset-0 opacity-[0.035]" style={{ backgroundImage: "radial-gradient(#1c1917 1px, transparent 1px)", backgroundSize: "18px 18px" }} />

      <header className="relative border-b border-stone-200/80 bg-[#fbfaf7]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-stone-950 p-2 text-white shadow-sm">
              <Icon name="book" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">FirstFinder</h1>
              <p className="text-sm text-stone-500">Meaningful discovery for serious book people.</p>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm text-stone-600 md:flex">
            <a href="#discover" className="hover:text-stone-950">Discover</a>
            <a href="#stories" className="hover:text-stone-950">Stories</a>
            <a href="#verify" className="hover:text-stone-950">Verify</a>
            <a href="#wants" className="hover:text-stone-950">Want List</a>
          </nav>

          <Button>Join beta</Button>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/85 px-4 py-2 text-sm text-stone-600 shadow-sm">
              <Icon name="spark" size={15} /> Start with a memory, a collector goal, or a book you cannot stop thinking about
            </div>

            <h2 className="max-w-4xl font-serif text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
              Find the book that feels right — not just the one that exists.
            </h2>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-stone-600">
              Describe what you want like you would to a rare book dealer. FirstFinder helps turn vague taste, nostalgia, edition points, and budget into a clearer path to the right copy.
            </p>

            <div className="mt-9 rounded-[2rem] border border-stone-200 bg-white/90 p-4 shadow-sm shadow-stone-200/70">
              <div className="rounded-[1.5rem] bg-stone-50 p-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-stone-400">Tell FirstFinder</p>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="I’m looking for a first edition of The Stand with a dust jacket under $1,000…"
                  className="min-h-28 w-full resize-none bg-transparent text-lg leading-8 outline-none placeholder:text-stone-400"
                  aria-label="Describe the book you want"
                />
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {promptChips.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => submitSearch(prompt)}
                      className="rounded-full border border-stone-200 bg-white px-3 py-2 text-left text-xs text-stone-600 transition hover:border-stone-400 hover:text-stone-950"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <Button onClick={() => submitSearch()} className="shrink-0">Start exploring</Button>
              </div>
            </div>
          </div>

          <div className="rounded-[2.25rem] border border-stone-200 bg-white p-4 shadow-xl shadow-stone-200/70">
            <div className="rounded-[1.75rem] bg-stone-950 p-6 text-white">
              <p className="text-sm text-stone-300">A collector-minded answer</p>
              <div className="mt-5 max-h-72 space-y-3 overflow-auto pr-1">
                {messages.slice(-4).map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-white text-stone-950" : "bg-white/10 text-stone-100"}`}>
                      {message.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 p-2 pt-4 sm:grid-cols-3">
              <MiniStat label="Discovery type" value="Story-led" />
              <MiniStat label="Want-list fit" value="Ranked" />
              <MiniStat label="Next step" value="Track or verify" />
            </div>
          </div>
        </section>

        <section id="discover" className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-stone-400">Where collectors are looking right now</p>
              <h3 className="mt-3 font-serif text-4xl font-semibold tracking-tight">Curated paths into special copies</h3>
            </div>
            <p className="max-w-md text-sm leading-6 text-stone-500">
              Not just listings — why the edition matters, what to check, and whether it fits the story you care about.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {(matches.length ? matches : discoveryCards).map((book) => (
              <Card key={book.title} className="group overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
                <div className="h-36 bg-gradient-to-br from-stone-200 to-stone-100 p-5">
                  <div className="flex h-full items-end justify-between">
                    <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-stone-700 shadow-sm">{book.mood}</div>
                    <Icon name="bookmark" className="text-stone-500" />
                  </div>
                </div>
                <CardContent>
                  <p className="text-sm text-stone-500">{book.author}</p>
                  <h4 className="mt-1 font-serif text-3xl font-semibold">{book.title}</h4>
                  <p className="mt-3 text-sm font-medium text-stone-700">{book.edition}</p>
                  <p className="mt-4 leading-7 text-stone-600">{book.hook}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {book.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600">{tag}</span>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-5">
                    <span className="text-sm font-semibold text-stone-900">{book.price}</span>
                    <button className="text-sm font-medium text-stone-950 underline-offset-4 hover:underline">Explore path</button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="stories" className="mx-auto grid max-w-7xl gap-5 px-6 py-16 md:grid-cols-3">
          <Feature icon="heart" title="Start with the personal connection" text="Search by memory, gift, author obsession, genre, or the kind of copy that would actually feel meaningful on your shelf." />
          <Feature icon="search" title="Translate taste into criteria" text="Turn a vague goal into edition points, publishers, jacket requirements, condition tradeoffs, and realistic price ranges." />
          <Feature icon="bell" title="Know when the right copy appears" text="Track wants by story, not just keywords, so the platform can flag copies that match why you care." />
        </section>

        <section id="verify" className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-stone-400">Already found a copy?</p>
            <h3 className="mt-3 font-serif text-4xl font-semibold tracking-tight">Verify it before you buy it.</h3>
            <p className="mt-4 leading-8 text-stone-600">
              Once discovery gets you close, upload photos to check edition points, dust jacket details, condition clues, and confidence before committing.
            </p>
          </div>

          <Card>
            <CardContent>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-500">Edition checker</p>
                  <h4 className="text-2xl font-semibold">Upload a copyright page</h4>
                </div>
                <Icon name="camera" size={26} className="text-stone-500" />
              </div>
              <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
                <p className="font-medium">Drop photos here</p>
                <p className="mt-2 text-sm text-stone-500">Cover, copyright page, dust jacket flap, spine, boards, and any signature page.</p>
                <Button variant="secondary" className="mt-5">Analyze edition points</Button>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MiniStat label="Matched points" value="12/14" />
                <MiniStat label="Confidence" value="94%" />
                <MiniStat label="Est. value" value="$5.8K" />
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="wants" className="mx-auto max-w-7xl px-6 pb-24">
          <Card className="bg-stone-950 text-white shadow-xl">
            <CardContent className="grid gap-8 md:grid-cols-[.85fr_1.15fr] md:items-center">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-stone-400">Living want list</p>
                <h3 className="mt-3 font-serif text-4xl font-semibold tracking-tight">Save the stories you are trying to find.</h3>
                <p className="mt-4 leading-7 text-stone-300">
                  FirstFinder should remember the details that make a copy matter: the memory, the edition, the flaws you’ll accept, and the price that still feels right.
                </p>
              </div>
              <div className="grid gap-3">
                {savedWants.map((want) => (
                  <div key={want} className="flex items-center justify-between gap-4 rounded-2xl bg-white/10 px-4 py-4">
                    <span>{want}</span>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-950">Tracking</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-[2rem] border border-stone-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

function Button({ children, variant = "primary", className = "", onClick }) {
  const styles = variant === "secondary"
    ? "border border-stone-200 bg-white text-stone-950 hover:bg-stone-50"
    : "bg-stone-950 text-white hover:bg-stone-800";

  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-medium transition ${styles} ${className}`}>
      {children}
    </button>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-stone-100 p-4 text-stone-950">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Feature({ icon, title, text }) {
  return (
    <Card>
      <CardContent>
        <div className="mb-5 inline-flex rounded-2xl bg-stone-100 p-3 text-stone-700">
          <Icon name={icon} size={24} />
        </div>
        <h4 className="font-serif text-2xl font-semibold">{title}</h4>
        <p className="mt-3 leading-7 text-stone-600">{text}</p>
      </CardContent>
    </Card>
  );
}

function Icon({ name, size = 20, className = "" }) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  const paths = {
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" /></>,
    spark: <><path d="M12 2v5" /><path d="M12 17v5" /><path d="M4.22 4.22l3.54 3.54" /><path d="M16.24 16.24l3.54 3.54" /><path d="M2 12h5" /><path d="M17 12h5" /><path d="M4.22 19.78l3.54-3.54" /><path d="M16.24 7.76l3.54-3.54" /></>,
    bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z" /><circle cx="12" cy="13" r="3" /></>,
  };

  return <svg {...commonProps}>{paths[name] || paths.book}</svg>;
}
