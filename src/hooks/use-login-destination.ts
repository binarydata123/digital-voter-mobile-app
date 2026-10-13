import { useEffect, useState } from "react";

import {
  ensureAuthSession,
  getDefaultPoliticianRoute,
  refreshCurrentUser,
} from "@/services/authentication";

type LoginDestination = NonNullable<ReturnType<typeof getDefaultPoliticianRoute>> | "/login";

export function useLoginDestination() {
  const [destination, setDestination] = useState<LoginDestination | null>(null);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      let next: LoginDestination = "/login";
      try {
        const session = await ensureAuthSession();
        const user = session.user ?? (await refreshCurrentUser());
        next = getDefaultPoliticianRoute(user) ?? "/login";
      } catch {
        // Missing sessions remain on the sign-in screen.
      }
      if (active) setDestination(next);
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  return destination;
}
