import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

const projectId = 'demo-kreditjatek-rules';
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: {
    rules: fs.readFileSync('firestore.rules', 'utf8'),
  },
});

await testEnv.clearFirestore();

const trainerUid = 'trainer-user';
const playerUid = 'player-user';
const otherUid = 'other-user';
const code = 'ABC123';
const playerId = 'device-player-id';

const trainerDb = testEnv.authenticatedContext(trainerUid).firestore();
const playerDb = testEnv.authenticatedContext(playerUid).firestore();
const otherDb = testEnv.authenticatedContext(otherUid).firestore();
const anonDb = testEnv.unauthenticatedContext().firestore();

await assertSucceeds(setDoc(doc(trainerDb, 'games', code), {
  trainerUid,
  roundKey: 'lobby',
  status: 'lobby',
  session: { roundKey: 'lobby' },
}));

await assertSucceeds(setDoc(doc(trainerDb, 'publicGames', code), {
  trainerUid,
  status: 'lobby',
  roundKey: 'lobby',
  expectedPlayerCount: 2,
  joinedCount: 0,
  createdAt: new Date().toISOString(),
}));

await assertFails(getDoc(doc(anonDb, 'publicGames', code)));
await assertSucceeds(getDoc(doc(playerDb, 'publicGames', code)));
await assertSucceeds(getDocs(collection(playerDb, 'publicGames')));

const validPlayer = {
  playerId,
  authUid: playerUid,
  name: 'Teszt Elek',
  joinedAt: new Date().toISOString(),
  lastSeenAt: Timestamp.now(),
  commands: {},
};

await assertSucceeds(setDoc(doc(playerDb, 'games', code, 'players', playerId), validPlayer));

await assertFails(setDoc(doc(otherDb, 'games', code, 'players', 'other-slot'), {
  ...validPlayer,
  playerId: 'other-slot',
  authUid: playerUid,
}));

await assertSucceeds(getDoc(doc(playerDb, 'games', code, 'players', playerId)));
await assertFails(getDoc(doc(otherDb, 'games', code, 'players', playerId)));
await assertSucceeds(getDoc(doc(trainerDb, 'games', code, 'players', playerId)));

await assertSucceeds(updateDoc(doc(playerDb, 'games', code, 'players', playerId), {
  lastSeenAt: Timestamp.now(),
  commands: {
    c1: {
      id: 'c1',
      nonce: 'n1',
      type: 'submitStrategicDecision',
      payload: { type: 'dictator_give', amount: 1000 },
      createdAt: new Date().toISOString(),
    },
  },
}));

await assertSucceeds(updateDoc(doc(playerDb, 'games', code, 'players', playerId), {
  commands: {
    reflection1: {
      id: 'reflection1',
      nonce: 'reflection-nonce',
      type: 'submitReflection',
      payload: {
        items: [{ decisionId: 'decision:ultimatum:proposer:pair-own', comment: 'Teszt reflexió' }],
      },
      createdAt: new Date().toISOString(),
    },
  },
}));

await assertFails(updateDoc(doc(playerDb, 'games', code, 'players', playerId), {
  view: { secret: true },
}));

await assertSucceeds(updateDoc(doc(trainerDb, 'games', code, 'players', playerId), {
  view: { roundKey: 'lobby' },
}));

await assertSucceeds(updateDoc(doc(trainerDb, 'games', code), {
  roundKey: '1a',
  status: 'active',
  session: { roundKey: '1a' },
}));

await assertFails(setDoc(doc(otherDb, 'games', code, 'players', 'late-player'), {
  playerId: 'late-player',
  authUid: otherUid,
  name: 'Későn érkező',
  joinedAt: new Date().toISOString(),
  lastSeenAt: Timestamp.now(),
  commands: {},
}));

const playerSnapshot = await getDoc(doc(playerDb, 'games', code, 'players', playerId));
assert.equal(playerSnapshot.data()?.authUid, playerUid);

await testEnv.cleanup();
console.log('FIRESTORE DEPLOYED-RULE COMPATIBILITY AUDIT OK');
