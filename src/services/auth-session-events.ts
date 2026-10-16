type SessionNotice = { message: string; invalidated: boolean };
const listeners = new Set<(notice: SessionNotice) => void>();

export function notifyAuthSession(notice: SessionNotice) {
  for (const listener of listeners) listener(notice);
}

export function subscribeAuthSession(listener: (notice: SessionNotice) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
