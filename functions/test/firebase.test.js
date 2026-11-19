import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth'
import {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadString,
  getDownloadURL,
  getBytes,
} from 'firebase/storage'
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'

const projectId = 'tap-io-517cd'

test(
  'Firebase protects accounts, card claims, prices, orders, and conversations',
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async (t) => {
    const environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      },
    })
    const apps = []
    async function customer(username, requestedUsername = username) {
      const app = initializeApp(
        { apiKey: 'fake-key', projectId, storageBucket: 'tap-io-517cd.firebasestorage.app' },
        username,
      )
      apps.push(app)
      const auth = getAuth(app)
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
      const db = getFirestore(app)
      connectFirestoreEmulator(db, '127.0.0.1', 8080)
      const storage = getStorage(app)
      connectStorageEmulator(storage, '127.0.0.1', 9199)
      const { user } = await createUserWithEmailAndPassword(
        auth,
        username + '@example.com',
        'Test-password-123!',
      )
      const { tapio } = await import('../index.js')
      const invoke = async (action, data = {}) =>
        tapio.run({
          auth: { uid: user.uid, token: { email: user.email } },
          data: { action, ...data },
          rawRequest: { ip: '127.0.0.1' },
        })
      const record = await invoke('register', { username: requestedUsername, name: username })
      return { uid: user.uid, db, storage, invoke, record }
    }
    try {
      await environment.clearFirestore()
      const alice = await customer('alice'),
        bob = await customer('bobby'),
        admin = await customer('store-admin')
      await environment.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'admins', admin.uid), { enabled: true })
      })
      await admin.invoke('initializeCatalog')
      await t.test(
        'customers cannot grant admin access, read private accounts, or write records directly',
        async () => {
          await assertFails(setDoc(doc(alice.db, 'admins', alice.uid), { enabled: true }))
          await assertFails(getDoc(doc(bob.db, 'users', alice.uid)))
          await assertFails(setDoc(doc(alice.db, 'users', alice.uid), { session: 'admin' }))
          await assert.rejects(alice.invoke('generateCard'), /Administrator/)
          assert.equal(
            (await bob.invoke('register', { username: 'alice', name: 'Another Alice' })).account
              .username,
            'bobby',
          )
          await assert.rejects(customer('duplicate', 'alice'), /already in use/)
          await environment.withSecurityRulesDisabled(async (context) =>
            setDoc(doc(context.firestore(), 'admins', alice.uid), { enabled: false }),
          )
          await assert.rejects(alice.invoke('generateCard'), /Administrator/)
          await assertFails(getDoc(doc(alice.db, 'users', bob.uid)))
        },
      )
      await t.test(
        'published profiles are readable on another device and exclude hidden data',
        async () => {
          const p = {
            ...alice.record.drafts.Professional,
            name: 'Alice',
            email: 'secret@example.com',
            phone: '+639171234567',
            privacy: { email: 'Hidden', phone: 'Hidden' },
            sections: [{ id: 'secret', type: 'About', body: 'Keep private', hidden: true }],
          }
          await alice.invoke('saveWorkspace', {
            change: { published: { Personal: null, Professional: p }, active: 'Professional' },
          })
          const publicData = (
            await assertSucceeds(
              getDoc(
                doc(environment.unauthenticatedContext().firestore(), 'publicProfiles', 'alice'),
              ),
            )
          ).data()
          assert.equal(publicData.profile.name, 'Alice')
          assert.equal(publicData.profile.email, '')
          assert.equal(publicData.profile.phone, '')
          assert.equal(publicData.profile.sections.length, 0)
          await assert.rejects(
            bob.invoke('saveWorkspace', {
              change: { account: { ...bob.record.account, username: 'alice' } },
            }),
            /cannot be changed/,
          )
        },
      )
      await t.test(
        'a physical-card identifier can be claimed once and activation secrets stay private',
        async () => {
          const card = await admin.invoke('generateCard', { name: 'Classic', tone: 'chalk' })
          await assertFails(getDoc(doc(alice.db, 'cardSecrets', card.id)))
          await assert.rejects(
            alice.invoke('claimCard', { id: card.id, code: 'WRONG' }),
            /incorrect/,
          )
          const results = await Promise.allSettled([
            alice.invoke('claimCard', { id: card.id, code: card.activationCode }),
            bob.invoke('claimCard', { id: card.id, code: card.activationCode }),
          ])
          assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
          const winner = results[0].status === 'fulfilled' ? alice : bob
          const retry = await winner.invoke('claimCard', { id: card.id, code: card.activationCode })
          assert.equal(retry.ownerUid, winner.uid)
        },
      )
      await t.test(
        'checkout ignores submitted prices, retries are idempotent, and orders are private',
        async () => {
          await admin.invoke('saveProduct', {
            product: {
              id: 'classic',
              name: 'Classic',
              price: 499,
              stock: 3,
              available: true,
              tone: 'chalk',
              colors: 'Chalk',
            },
          })
          const input = {
            requestId: 'regression-order',
            shippingName: 'Alice',
            address: 'Manila',
            phone: '+63 917 123 4567',
            items: [{ productId: 'classic', quantity: 2, price: 0.01 }],
            total: 0.02,
          }
          const first = await alice.invoke('placeOrder', input)
          assert.equal(first.total, 998)
          assert.equal((await alice.invoke('placeOrder', input)).id, first.id)
          await assertFails(getDoc(doc(bob.db, 'orders', first.id)))
          await assert.rejects(
            alice.invoke('orderStatus', { id: first.id, key: 'payment', value: 'Paid' }),
            /administrator/,
          )
          await assert.rejects(
            alice.invoke('orderStatus', { id: first.id, key: 'shipping', value: 'Shipped' }),
            /administrator/,
          )
          await assert.rejects(
            admin.invoke('orderStatus', { id: first.id, key: 'payment', value: 'Paid' }),
            /proof/,
          )
        },
      )
      await t.test(
        'uploads are private to the owner and payment proof requires an owned upload',
        async () => {
          const picture = ref(alice.storage, 'private/' + alice.uid + '/receipt.webp')
          await assertSucceeds(
            uploadString(picture, 'aGVsbG8=', 'base64', { contentType: 'image/webp' }),
          )
          await assertFails(getBytes(ref(bob.storage, picture.fullPath)))
          await assertFails(
            uploadString(ref(bob.storage, picture.fullPath), 'aGVsbG8=', 'base64', {
              contentType: 'image/webp',
            }),
          )
          const url = await getDownloadURL(picture)
          await alice.invoke('orderStatus', {
            id: 'TAP-regression-order',
            key: 'paymentProof',
            value: url,
          })
          await admin.invoke('orderStatus', {
            id: 'TAP-regression-order',
            key: 'payment',
            value: 'Paid',
          })
          await assert.rejects(
            alice.invoke('orderStatus', {
              id: 'TAP-regression-order',
              key: 'paymentProof',
              value: '',
            }),
            /already verified/,
          )
          const paid = (await getDoc(doc(alice.db, 'orders', 'TAP-regression-order'))).data()
          assert.equal(paid.payment, 'Paid')
          assert.equal((await getDoc(doc(alice.db, 'products', 'classic'))).data().stock, 1)
          await assert.rejects(
            admin.invoke('orderStatus', {
              id: 'TAP-regression-order',
              key: 'payment',
              value: 'Paid',
            }),
            /proof/,
          )
          assert.equal((await getDoc(doc(alice.db, 'products', 'classic'))).data().stock, 1)
          const p = { ...alice.record.drafts.Personal, name: 'Alice', avatar: url }
          await alice.invoke('saveWorkspace', {
            change: { published: { Personal: p, Professional: null }, active: 'Personal' },
          })
          const published = (await getDoc(doc(alice.db, 'publicProfiles', 'alice'))).data()
          assert.ok(
            decodeURIComponent(published.profile.avatar).includes('/public/' + alice.uid + '/'),
          )
        },
      )
      await t.test(
        'support threads are private and sender roles are assigned by the backend',
        async () => {
          await alice.invoke('sendMessage', {
            id: 'message-one',
            ownerUid: bob.uid,
            sender: 'admin',
            text: 'Help with my card',
          })
          const messages = await getDocs(
            query(collection(alice.db, 'messages'), where('ownerUid', '==', alice.uid)),
          )
          assert.equal(messages.size, 1)
          const message = messages.docs[0]
          assert.equal(message.data().sender, 'customer')
          await assertFails(getDoc(doc(bob.db, 'messages', message.id)))
          await admin.invoke('sendMessage', {
            id: 'reply-one',
            ownerUid: alice.uid,
            text: 'How can I help?',
          })
          assert.equal(
            (
              await getDocs(
                query(collection(alice.db, 'messages'), where('ownerUid', '==', alice.uid)),
              )
            ).size,
            2,
          )
        },
      )
    } finally {
      await Promise.all(apps.map(deleteApp))
      await environment.cleanup()
    }
  },
)
