// SQLite's web worker is not part of this app's offline strategy. Keeping this
// module web-specific prevents Metro from bundling expo-sqlite for the web app.
export function isLocalVoterDatabaseAvailable() {
  return false;
}

export async function deleteVoterDatabase() {
  // Voter data is never cached locally by the web build.
}
