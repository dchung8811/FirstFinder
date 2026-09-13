// Retrying a database write that failed for a reason that has nothing to do
// with the write.
//
// The case this was built for: an item saved, its four photos uploaded to
// storage with 200s, and then the PATCH that links them to the row came back
// 504. Storage was fine throughout -- Postgres was briefly unreachable. The
// app gave up, told the reader to re-add the photos, and re-adding them
// uploaded four more files, leaving the first four stranded in the bucket with
// nothing pointing at them.
//
// A retry a second later would have attached the photos that were already
// there. That is the whole idea: the paths are still in hand, so the same
// update can simply be sent again.
//
// Safe to repeat because these writes are idempotent -- an UPDATE that sets
// named columns on one id by primary key lands on the same row with the same
// values however many times it runs. Nothing here is an append or a counter
// increment, so a retry that succeeds after a response was lost in transit
// does no damage.

export const RECORD_WRITE_RETRY_DELAYS_MS = [1000, 3000, 8000];

// The observed stall lasted at least five seconds: the PATCH failed and an RPC
// fired five seconds later failed too. So an immediate second attempt is not
// enough on its own, and the delays climb past that window rather than
// hammering a database that is already struggling.

// Classes worth another attempt:
//   08  connection exception
//   53  insufficient resources (out of memory, too many connections)
//   57  operator intervention -- includes 57014, statement timeout
//
// An error carrying any other SQLSTATE is the database refusing this
// particular statement: a constraint violation or a type error will be refused
// just as firmly on the fourth try, and retrying only makes the reader wait
// twelve seconds for the same answer.
//
// No code at all means the failure happened before Postgres had an opinion --
// a gateway 502/504, a dropped connection, a DNS blip. Those are the ones
// worth repeating, so a missing code retries.
const RETRYABLE_SQLSTATE_CLASSES = ["08", "53", "57"];

export function isRetryableWriteError(error) {
  if (!error) return false;

  const code = typeof error.code === "string" ? error.code.trim() : "";
  if (!code) return true;

  return RETRYABLE_SQLSTATE_CLASSES.includes(code.slice(0, 2));
}

// Runs `attempt` until it comes back without an error or the delays run out.
//
// `attempt` is expected to resolve to a Supabase-shaped `{ data, error }`
// rather than to throw, which is what the client does. `sleep` is a parameter
// so the schedule can be tested without spending eleven seconds proving it.
//
// Returns the last result with `attempts` added, so a caller can tell a
// first-try success from one that needed three goes and say so in a log.
export async function withWriteRetry(
  attempt,
  { delays = RECORD_WRITE_RETRY_DELAYS_MS, sleep, isRetryable = isRetryableWriteError } = {}
) {
  const wait = sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let result = null;

  for (let index = 0; ; index += 1) {
    result = await attempt(index);

    if (!result || !result.error) return { ...(result || {}), attempts: index + 1 };
    if (index >= delays.length) return { ...result, attempts: index + 1 };
    if (!isRetryable(result.error)) return { ...result, attempts: index + 1 };

    await wait(delays[index]);
  }
}
