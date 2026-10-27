// Turns a database/API error into a short message that is safe to show a user.
// The technical detail is written to the console only.

type ApiError = { message?: string; code?: string };

export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): Error {
  const e = (error ?? {}) as ApiError;
  if (e.message) console.error("[api]", e.code ?? "", e.message);
  switch (e.code) {
    case "23505": return new Error("That already exists.");
    case "23514": return new Error("Please check what you entered.");
    case "23503": return new Error("That item is linked to other data and could not be changed.");
    case "42501": return new Error("You are not allowed to do this.");
    default:
      if (e.message && /failed to fetch|network/i.test(e.message)) {
        return new Error("We could not reach the server. Check your connection and try again.");
      }
      return new Error(fallback);
  }
}
