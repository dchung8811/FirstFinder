import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";
import { withMailer } from "../../../src/lib/email";
import { firstItemEmail } from "../../../src/utils/email";

// Sends "You added your first book!" to the signed-in collector, once.
//
// Items are inserted straight from the browser and the iOS app under RLS, so
// no server code runs when one is added. The app calls this afterwards
// instead, and everything that matters is decided here, not by the caller:
// whether they really have an item, and whether the email has gone already.
// Calling it again, or on every add, is harmless.
//
// The claim in first_item_emails (supabase/first-item-email.sql) is what
// makes it once: two tabs adding at the same moment both get here, and only
// one wins the insert. A send that fails gives the claim back, so the next
// item they add tries again.
//
// The response is always 200 with a status unless the caller isn't signed in.
// The add already succeeded; nothing about the email should look like it
// failed.
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("[first-item-email]", error.message);
    return NextResponse.json({ status: "unavailable" });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  const user = userData?.user;
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  // The item is read here, not taken from the request, so the email can only
  // ever name something that is actually in this person's collection.
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("inventory_items")
    .select("name, category")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  if (itemsError) {
    console.error("[first-item-email] could not read items:", itemsError.message);
    return NextResponse.json({ status: "unavailable" });
  }
  if (!items?.length) {
    return NextResponse.json({ status: "no_items" });
  }

  // An Apple sign-in with a hidden address still has one (a private relay
  // address); only an account with no email at all lands here.
  if (!user.email) {
    return NextResponse.json({ status: "no_email" });
  }

  const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_first_item_email", { p_user_id: user.id });
  if (claimError) {
    // Most likely supabase/first-item-email.sql hasn't been run. Without the
    // claim there is no way to promise "once", so nothing is sent.
    console.error("[first-item-email] could not claim:", claimError.message);
    return NextResponse.json({ status: "unavailable" });
  }
  if (!claimed) {
    return NextResponse.json({ status: "already_handled" });
  }

  const [item] = items;
  const message = firstItemEmail({
    itemName: item.name,
    category: item.category,
    fullName: user.user_metadata?.full_name
  });
  const result = await withMailer((mailer) => mailer.send({ to: user.email, ...message }));

  if (result.ok) {
    const { error } = await supabaseAdmin
      .from("first_item_emails")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("user_id", user.id);
    // The email went. If recording that failed, the row stays at 'sending'
    // and could be retaken in fifteen minutes -- a possible second copy,
    // which is the lesser problem than saying it didn't send.
    if (error) console.error("[first-item-email] sent but not recorded:", error.message);
    return NextResponse.json({ status: "sent" });
  }

  // Not sent, for whatever reason -- including no Gmail settings at all -- so
  // the claim is given back and the next add tries again. Only this request's
  // own 'sending' row is removed, never a 'sent' or 'existing' one.
  const { error: releaseError } = await supabaseAdmin
    .from("first_item_emails")
    .delete()
    .eq("user_id", user.id)
    .eq("status", "sending");
  if (releaseError) console.error("[first-item-email] could not release claim:", releaseError.message);

  return NextResponse.json({ status: result.reason });
}
