import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// The two writes that can strand photos in the bucket, and the message the
// reader gets when one of them fails.
//
// The incident: an item saved, four photos uploaded with 200s, then the PATCH
// linking them came back 504. The toast said "Make sure the item-photos
// storage bucket is set up, then re-add the photos" -- pointing at the one
// component that had worked perfectly, and prescribing the action that
// duplicates data. Re-adding uploaded four more files and left the first four
// orphaned.
//
// Read as text for the reason adminChecksWiring.test.js gives: these are
// handlers inside a "use client" component that drags in the Supabase browser
// client, and what is worth protecting is that the retry is still wrapped
// around the write and that the message still says the right thing.
const APP = resolve(process.cwd(), "app/InventoryApp.jsx");
const source = readFileSync(APP, "utf8");

describe("photo record writes", () => {
  // Both paths upload first and write second, so both can strand files.
  it("retries every write that happens after photos have landed in storage", () => {
    const wrapped = source.match(/withWriteRetry\(/g) || [];
    expect(wrapped.length).toBeGreaterThanOrEqual(2);
  });

  it("retries the link write on the create path", () => {
    const create = /const \{ data: updated, error: updateError, attempts \} =[\s\S]{0,400}/.exec(source);
    expect(create).not.toBeNull();
    expect(create[0]).toContain("withWriteRetry");
    expect(create[0]).toContain("item_photos");
  });

  it("retries the update on the edit path", () => {
    const edit = /const \{ data, error, attempts \} = await withWriteRetry\(/.exec(source);
    expect(edit).not.toBeNull();
  });
});

describe("what the reader is told when photos do not get linked", () => {
  // The uploaded files are already in storage. Re-adding them uploads a second
  // copy and orphans the first -- which is exactly what happened.
  it("never tells them to re-add photos that already uploaded", () => {
    const linkMessages = source.match(/could not be linked[^`"]*|linking them to the item didn't save[^`"]*/g) || [];
    expect(linkMessages.length).toBeGreaterThan(0);
    linkMessages.forEach((message) => {
      expect(message).toMatch(/save again/);
      expect(message).toMatch(/duplicates/);
    });
  });

  // One combined `failures` list was what let a database timeout be reported
  // as a storage-bucket problem. Asserting the branch rather than the names:
  // the two have to lead to different messages, not merely exist.
  it("keeps upload failures and link failures apart", () => {
    expect(source).toMatch(/if \(photoLinkFailed\) \{/);
    // A distinct branch for uploads that failed on their own.
    expect(source).toMatch(/\} else if \(uploadFailures\.length > 0\) \{/);
    // And they are genuinely two things, not one aliased to the other.
    expect(source).toMatch(/const uploadFailures = \[\];/);
    expect(source).toMatch(/let photoLinkFailed = false;/);
    expect(source).not.toMatch(/uploadFailures\s*=\s*failures/);
  });

  // Still correct for the failure it actually describes: a photo that never
  // reached storage does have to be added again.
  it("still says to re-add photos that genuinely failed to upload", () => {
    expect(source).toMatch(/failed to upload: \$\{uploadFailures\.join\(", "\)\}[^`]*re-add those photos/);
  });

  // The bucket advice is fine where uploads really did fail, and on the
  // separate "could not load photos" error. It must not reach a reader whose
  // uploads returned 200 and whose database write timed out.
  it("no longer blames the storage bucket for a failed record write", () => {
    const toastArgs = source.match(/pushToast\(\s*`[^`]*item-photos storage bucket[^`]*`/g) || [];
    expect(toastArgs.length).toBe(1);
    expect(toastArgs[0]).toContain("failed to upload");
    expect(toastArgs[0]).not.toMatch(/linked|linking/);
  });
});
