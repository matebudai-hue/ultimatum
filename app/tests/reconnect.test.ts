import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: dom.window.sessionStorage, configurable: true });
Object.defineProperty(globalThis, 'CustomEvent', { value: dom.window.CustomEvent, configurable: true });
Object.defineProperty(globalThis, 'StorageEvent', { value: dom.window.StorageEvent, configurable: true });

const { localSessionStore } = await import('../src/sessionStore.ts');

const game = localSessionStore.create(100_000, 2);
localSessionStore.join(game.code, 'returning-player', 'Visszatérő');
localSessionStore.join(game.code, 'partner', 'Partner');
localSessionStore.startGame(game.code);

const resumed = await localSessionStore.resumePlayer(game.code, 'returning-player');
assert.ok(resumed, 'A korábban belépett résztvevő aktív játék közben is visszaállítható legyen.');
assert.equal(resumed?.name, 'Visszatérő');
assert.equal(resumed?.session.roundKey, '1a');
assert.ok(resumed?.session.players.some((player) => player.id === 'returning-player'));

const stranger = await localSessionStore.resumePlayer(game.code, 'new-device');
assert.equal(stranger, null, 'Ismeretlen azonosító ne vehesse át egy meglévő résztvevő helyét.');

await assert.rejects(
  () => localSessionStore.prepareJoin(game.code),
  /már elindult/,
  'Új belépő aktív játékhoz továbbra se csatlakozhasson.',
);

console.log('PARTICIPANT ACTIVE-GAME RECONNECT OK');
process.exit(0);
