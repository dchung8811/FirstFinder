// The step-by-step guides behind the Features page, one per feature that has
// one. Rendered by app/features/[slug]/page.js.
//
// The screenshots in public/features/ were taken from the maintainer's own
// account on firstfinder.app, by their choice, so the titles and values in
// them are real. Receipt photos, the account's email address, and /admin were
// deliberately kept out of every capture: receipts can carry a home address,
// and these images are public and live in a public repo. Keep it that way
// when replacing one.
//
// Every claim here describes what the app does today. When a flow changes,
// the guide and its screenshots are part of that change.

const PHONE = { kind: "phone", width: 750, height: 1624 };

export const featureGuides = [
  {
    // Cropped from a screen recording on the maintainer's phone. The crops
    // start below the dashboard totals, which sit just above Quick Add on
    // Add Items, so the screenshots show the scan and nothing about money.
    slug: "snap-a-picture",
    title: "Fill in an item by snapping a picture",
    summary: "Photograph a book's cover and copyright page in Quick Add, and FirstFinder fills in the title, author, publisher, and printing, and the edition when the page states it, with the reasoning shown so you can check it against the book.",
    why: [
      "Adding a book goes from typing every field to checking a few.",
      "The printing comes from the number line, worked out the same way every time, with the reason written next to the form.",
      "It only reads what's printed. Nothing is looked up or guessed, and anything you've already typed is left alone.",
      "Both photos stay with the item, so the copyright page is on file as evidence."
    ],
    steps: [
      {
        title: "Open Quick Add",
        body: "From the menu, choose Add Items. Snap a picture sits at the top of the Quick Add card, above the fields it fills.",
        image: { kind: "phone", width: 750, height: 1057, src: "/features/snap-a-picture/snap-button.jpg", alt: "The Quick Add card, New collectible, with a Snap a picture button above empty Item name, Category, and What you paid fields." }
      },
      {
        title: "Take a photo, or pick one you already have",
        body: "Tap Snap a picture. On a phone you can take a photo there and then, or choose from your library. You can send up to 3 photos at once, so the cover and copyright page can go together.",
        image: { kind: "phone", width: 750, height: 808, src: "/features/snap-a-picture/camera-or-library.jpg", alt: "The phone's menu over the Snap a picture button, offering Photo Library, Take Photo, and Choose Files." }
      },
      {
        title: "Snap the cover",
        body: "A straight-on shot of the front cover, title and author readable, is all it needs.",
        image: { kind: "phone", width: 750, height: 1531, src: "/features/snap-a-picture/cover-photo.jpg", alt: "The phone camera's Use Photo screen showing the dust jacket of Lonesome Dove by Larry McMurtry on a wooden table." }
      },
      {
        title: "Check what it filled in",
        body: "The title and author go into the form, and a panel says how many fields were filled. A cover can't show who published it or which printing it is, so it asks for the copyright page next.",
        image: { kind: "phone", width: 750, height: 1345, src: "/features/snap-a-picture/after-cover.jpg", alt: "Quick Add after scanning the cover: Filled 2 fields from your photos, a note reading No copyright page in that scan. Snap it next for the publisher, edition, and printing, and Item name filled in as Lonesome Dove." }
      },
      {
        title: "Snap the copyright page",
        body: "Tap Snap another page and photograph the back of the title page: the block with the copyright, the publisher's address, and the row of numbers. Get the whole number line in the frame.",
        image: { kind: "phone", width: 750, height: 1531, src: "/features/snap-a-picture/copyright-photo.jpg", alt: "The phone camera's Use Photo screen showing the copyright page of Lonesome Dove, with Simon and Schuster's details and the number line 10 9 8 7 6 5 4 3 2 1." }
      },
      {
        title: "Read the reasoning",
        body: "The panel shows what it read, the number line, year, and ISBN, and why it chose the printing. Here the lowest number on the line is 1, so it's a first printing. Hold it up next to the book.",
        image: { kind: "phone", width: 750, height: 1345, src: "/features/snap-a-picture/number-line.jpg", alt: "The scan panel listing Number line 10 9 8 7 6 5 4 3 2 1, Year 1985, ISBN 0-671-50420-7, and the reason: The lowest number on the number line is 1, so this is the first printing." }
      },
      {
        title: "Check the fields",
        body: "The publisher is filled in from the copyright page, alongside the title and author from the cover. Every field stays editable, so correct anything it misread.",
        image: { kind: "phone", width: 750, height: 336, src: "/features/snap-a-picture/author-publisher.jpg", alt: "The Author field filled in as Larry McMurtry and Make / Publisher / Brand as Simon and Schuster." }
      },
      {
        title: "Fill in the rest, then submit",
        body: "The printing is set from the number line. The edition is filled in only when the page says so in words; Lonesome Dove's doesn't, so it was set to First by hand here. Both photos are already attached as item photos. Add what you paid and anything else you know, and tap Submit.",
        image: { kind: "phone", width: 750, height: 1113, src: "/features/snap-a-picture/edition-printing.jpg", alt: "Edition and Printing both set to First, and the Item photo section holding the cover and copyright page photos." }
      }
    ],
    tips: [
      "Anything you typed before scanning is never overwritten. A scan only fills fields that are still empty.",
      "It knows Random House's habit of printing \"First Edition\" over a number line that starts at 2, and calls those first printings.",
      "Book club editions are marked as Other, never First, whatever else the page says.",
      "Scanning needs a connection. Offline, add the item by hand and the photos sync later.",
      "Photos go to OpenAI to be read. Scanning doesn't search the web or estimate a value. For that, use Research what it's worth at the bottom of Add Items."
    ]
  },
  {
    slug: "identify-from-a-photo",
    title: "Identify an item from a photo",
    summary: "Optional AI research: photograph a cover and FirstFinder searches for comparable sales, then drafts the record with a suggested edition and a value range, ready for you to check and save.",
    video: {
      src: "/firstfinder-ai-feature.mp4",
      poster: "/firstfinder-ai-feature-poster.jpg",
      caption: "The whole flow, from photo to saved record."
    },
    why: [
      "Cataloguing a stack of finds goes from typing every field to checking a draft.",
      "The photo you take is attached to the record, so the cover is on file from the start.",
      "Values for books come from a live search of what copies are listed for, not from memory."
    ],
    steps: [
      {
        title: "Open Add Items",
        // The start.jpg screenshot showed this card at the top of the page,
        // under its old title, so it is off until it is retaken from the
        // card's new place at the bottom.
        body: "From the menu, choose Add Items and scroll to the last card, Research what it's worth. (To fill in the fields without the research, use Snap a picture in Quick Add instead.)"
      },
      {
        title: "Take or upload a photo of the cover",
        body: "Tap Research a photo. On a phone this opens the camera; on a computer, pick an image file. A clear, straight-on shot of the cover or title page works best."
      },
      {
        title: "Check the draft",
        body: "FirstFinder fills in what it can see and find: title, author, publisher, edition, and an estimated value. Every field stays editable. Correct anything it got wrong before you save."
      },
      {
        title: "Add what you paid, then save",
        body: "The one thing a photo can't tell us is what you paid for it. Enter that, and the item joins your collection with the photo attached."
      }
    ],
    tips: [
      "Each account gets 2 identifications a day. Every one is a paid, search-grounded call, and FirstFinder is self-funded.",
      "Identification is a starting point, not an appraisal. Condition, the jacket, and provenance decide what a particular copy is worth.",
      "Ran out for the day? Snap a picture, in Quick Add on the same page, still fills in the fields from your photos. It doesn't research a value."
    ]
  },
  {
    slug: "works-offline",
    title: "Works with no signal",
    summary: "Install FirstFinder on your phone and your collection opens in a basement with no bars. Finds you add offline wait on the phone and upload when you're back.",
    why: [
      "Check whether you already own a book while you're standing in a shop with no reception.",
      "Record a find the moment you're holding it, photos included, instead of trying to remember later.",
      "Nothing is lost if the connection drops halfway through."
    ],
    steps: [
      {
        title: "Install it on your home screen",
        body: "On an iPhone, open firstfinder.app in Safari, tap Share, then Add to Home Screen. On Android, open it in Chrome, open the menu, and choose Install app or Add to Home screen. Open FirstFinder from the new icon from then on."
      },
      {
        title: "Open it once while you're online",
        body: "FirstFinder keeps a copy of your collection on the phone each time it loads with a connection. That copy is what you'll see offline, so let it load once before you head somewhere without signal."
      },
      {
        title: "Use it as normal with no signal",
        body: "When the connection goes, a banner says you're offline and how old your copy is. Browse and search as usual, and add, edit, or mark items sold.",
        image: { ...PHONE, src: "/features/works-offline/offline-banner.jpg", alt: "The collection page with a yellow banner: You're offline. This is your collection as it was 2 minutes ago — add and edit freely; it syncs when you reconnect." }
      },
      {
        title: "Let it sync when you're back",
        body: "Anything you changed offline is marked Waiting to sync and uploads by itself once you reconnect, photos included. Ten edits to the same item go up as one."
      }
    ],
    tips: [
      "Offline saves need browser storage. In a private window, or with site data blocked, FirstFinder refuses an offline save rather than accept one it can't keep.",
      "A change that fails to upload three times stops retrying and waits for you to look at it, rather than disappearing.",
      "Logging out clears the offline copy and any waiting saves from that phone."
    ]
  },
  {
    slug: "share-your-collection",
    title: "Share your collection",
    summary: "Publish a read-only page of your collection at a link you control. You choose who can see it and exactly what it shows.",
    why: [
      "Show a friend, a dealer, or a club what you have without sending a spreadsheet.",
      "It starts with titles, editions, condition, and photos, and nothing about money unless you turn that on.",
      "Visitors can search, filter, and open your photos, without being able to change anything."
    ],
    steps: [
      {
        title: "Open Share from your collection",
        body: "Go to My Collection and tap Share. A dot beside it means your page is live.",
        image: { ...PHONE, src: "/features/share-your-collection/collection-actions.jpg", alt: "The My Collection page with Share, Export for insurance, and Add to collection buttons, above totals for what you paid and estimated value." }
      },
      {
        title: "Choose who can see it",
        body: "Off means there is no page at all. Anyone with the link lets whoever holds it open the page. Listed on search engines also invites Google to index it. Copy link gives you the address to send; Reset link gives you a new one and breaks the old.",
        image: { ...PHONE, src: "/features/share-your-collection/link.jpg", alt: "The share dialog showing the live link with Copy link, Open preview, and Reset link buttons, and the Who can see it choices." }
      },
      {
        title: "Choose what it shows",
        body: "Start from Showcase, Collector's notes, or Full ledger, then fine-tune: what each item is worth, what you paid, how you got it, your notes, sold items, and your wishlist.",
        image: { ...PHONE, src: "/features/share-your-collection/what-it-shows.jpg", alt: "The Start from presets and the Also show switches: What it's worth, What I paid, How I got it, My notes, and Sold items." }
      },
      {
        title: "See it the way visitors do",
        body: "Open preview shows the public page. Visitors can search, filter by category and status, switch between cards and records, and open the photos full size.",
        image: { kind: "wide", width: 800, height: 900, src: "/features/share-your-collection/public-page.jpg", alt: "A public shared collection page with item counts, a search and filter bar, and cards with cover photos." }
      }
    ],
    tips: [
      "Notes often hold where something is stored. Read yours before turning My notes on.",
      "Turning Listed on search engines off again takes days to clear from search results.",
      "Want to appear on Explore too? That's a separate switch in the same dialog, and it only works for listed pages."
    ]
  },
  {
    slug: "wishlist",
    title: "Keep a wishlist",
    summary: "Track the copies you're hunting for, with the most you'd pay, and move one into your collection the moment you find it.",
    why: [
      "Describe the copy, not just the book: edition, printing, condition, jacket, signature.",
      "A ceiling you've written down is easier to stick to at the counter.",
      "Share your wishlist on your public page without ever sharing what you'd pay."
    ],
    steps: [
      {
        title: "Open your Wishlist",
        body: "Choose Wishlist from the menu. The top of the page shows how many copies you're still looking for and what you'd spend if you paid every ceiling.",
        image: { ...PHONE, src: "/features/wishlist/overview.jpg", alt: "The Wishlist page, titled The hunt, with an Add a want button and totals: still looking for 3 copies, $9,750 if you paid every ceiling." }
      },
      {
        title: "Add a want, and describe the copy",
        body: "Tap Add a want. Give the title and author, then the copy that counts: which edition and printing, the worst condition you'd accept, and whether the jacket or a signature matters.",
        image: { ...PHONE, src: "/features/wishlist/add-want.jpg", alt: "The Add a want form, What would you actually buy?, with title, author, and The copy that counts section for edition and printing." }
      },
      {
        title: "Set your ceiling and how badly you want it",
        body: "Won't pay over is your limit. How badly sorts it as a Grail, Actively hunting, or Someday. Keep this one to myself leaves it off your public page.",
        image: { ...PHONE, src: "/features/wishlist/how-badly.jpg", alt: "The rest of the form: Won't pay over, Preferred seller or country, How badly with Grail, Actively hunting, and Someday, and a Keep this one to myself checkbox." }
      },
      {
        title: "Search for it",
        body: "Each want has Search AbeBooks and eBay buttons built from the details you gave, so you can check what's out there in one tap.",
        image: { ...PHONE, src: "/features/wishlist/want-card.jpg", alt: "A wishlist card for Suttree by Cormac McCarthy: Won't pay over $1,750, First edition, First printing, Jacket required, with Search AbeBooks, eBay, Edit, and I found it buttons." }
      },
      {
        title: "Found it? Move it into your collection",
        body: "Tap I found it. FirstFinder shows what you wanted next to what you got, and reminds you of your ceiling when you enter what you paid.",
        image: { ...PHONE, src: "/features/wishlist/found-it.jpg", alt: "The Found it dialog for Suttree, showing You wanted: First edition, First printing, Jacket required, and What you got fields for condition and what you paid, with a reminder of the $1,750 limit." }
      },
      {
        title: "Photograph it right there",
        body: "Add photos of the copy and its receipt in the same step, then Add to collection. The hunt stays on record rather than being deleted.",
        image: { ...PHONE, src: "/features/wishlist/found-it-photos.jpg", alt: "The lower half of the Found it dialog with Photos of this copy and Receipt / proof upload areas." }
      }
    ],
    tips: [
      "Nothing on your wishlist counts toward what your collection is worth.",
      "Upgrade for links a want to a copy you already own that you're hoping to replace with a better one."
    ]
  },
  {
    slug: "bulk-edit",
    title: "Edit everything at once",
    summary: "Change dozens of items in a spreadsheet and upload them back, or fix one detail right in the table.",
    why: [
      "Fix a misspelled publisher across thirty books in one pass.",
      "Bring in a collection you've already catalogued somewhere else.",
      "You see exactly what will change before anything is saved."
    ],
    steps: [
      {
        title: "Quick fixes: edit in the Records view",
        body: "On My Collection, switch to Records. Tap any name, category, status, or amount to edit it in place. Enter saves; Escape cancels.",
        image: { ...PHONE, src: "/features/bulk-edit/records.jpg", alt: "My Collection in the Records view, with a note: Click any name, category, status, or amount to edit it here. Enter saves, Escape cancels." }
      },
      {
        title: "Edit one cell",
        body: "The cell turns into a text box with the current value. Change it and press Enter, or press Escape to leave it as it was.",
        image: { ...PHONE, src: "/features/bulk-edit/inline-edit.jpg", alt: "One row of the Records table with its name turned into an editable text box." }
      },
      {
        title: "Big changes: export your collection",
        body: "On My Collection, tap Export for insurance, then Export as CSV. Every row carries a ref column, like FF-0033, that ties it back to the item."
      },
      {
        title: "Change it in a spreadsheet",
        body: "Open the file in Excel, Numbers, or Google Sheets and edit what you need. Leave ref alone so each row updates its item instead of making a copy. To remove an item, put yes in its delete column. New rows with an empty ref become new items."
      },
      {
        title: "Upload it back",
        body: "Go to Add Items, scroll to Bulk upload, and tap Upload CSV. FirstFinder shows what will be added, changed, and deleted, and nothing is saved until you confirm.",
        image: { ...PHONE, src: "/features/bulk-edit/upload.jpg", alt: "The Bulk upload card, Import your collection by CSV, with Download CSV template and Upload CSV buttons." }
      }
    ],
    tips: [
      "Starting from scratch? Download CSV template gives you the columns with a sample row.",
      "Photos aren't part of the CSV. Add them to items one by one.",
      "The export covers your active collection. Sold items aren't in it, so change those one at a time.",
      "A ref is never reused, even after its item is deleted, so an old export can't update the wrong book."
    ]
  },
  {
    slug: "insurance-report",
    title: "Collection reports for insurance",
    summary: "A printable summary of everything you own and what it's worth, ready to save as a PDF for an insurer, an estate, or your own records.",
    why: [
      "Insurers ask for a list with values. This is that list, already made.",
      "Totals for what you paid and what it's worth sit at the top.",
      "Save a dated PDF now and then, and you have a record of the collection over time."
    ],
    steps: [
      {
        title: "Open it from your collection",
        body: "Go to My Collection and tap Export for insurance.",
        image: { ...PHONE, src: "/features/share-your-collection/collection-actions.jpg", alt: "The My Collection page with Share, Export for insurance, and Add to collection buttons." }
      },
      {
        title: "Check the totals",
        body: "The report covers your active collection: how many items, your total cost basis, and the total estimated value, followed by every item with its category, condition, purchase details, cost, and value.",
        image: { ...PHONE, src: "/features/insurance-report/report.jpg", alt: "The Collection report page with Back to collection, Export as CSV, and Print / Save as PDF buttons, and totals for active items, total cost basis, and total estimated value." }
      },
      {
        title: "Save it as a PDF",
        body: "Tap Print / Save as PDF and choose Save as PDF in your browser's print dialog. The printed version drops the app's menus and lays each item out so nothing is cut off at the page edge."
      },
      {
        title: "Or take the raw data",
        body: "Export as CSV downloads the same items as a spreadsheet, for an insurer's own form or your own records. Photos aren't included in the CSV."
      }
    ],
    tips: [
      "Sold items aren't in the report. It describes what you own now.",
      "The estimated total only adds up items that have a value. One you haven't appraised is left out, not counted as $0."
    ]
  }
];

export function getGuide(slug) {
  return featureGuides.find((guide) => guide.slug === slug) || null;
}

export function guidePath(guide) {
  return `/features/${guide.slug}`;
}
