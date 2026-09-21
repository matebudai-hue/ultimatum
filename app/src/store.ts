import { firebaseSessionStore } from './firebaseStore';
import { localSessionStore } from './sessionStore';

const params = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams();

const localOnly =
  typeof window === 'undefined' ||
  params.get('test') === '1' ||
  params.get('demo') === 'trainer';

export const gameStore = localOnly ? localSessionStore : firebaseSessionStore;
export type GameStore = typeof gameStore;
