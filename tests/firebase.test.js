import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { runAction, hashText, imagePrefix } from '../src/lib/firestore-actions.js'
import { publicProfile } from '../src/lib/domain.js'
import { emptyProfile } from '../src/data.js'

test(
  'Spark backend enforces ownership, prices, publication privacy, claims and payment review',
  { skip: !process.env.FIRESTORE_EMULATOR_HOST, timeout: 120000 },
  async (t) => {
    const env = await initializeTestEnvironment({
      projectId: 'tap-io-517cd',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    })
    await env.clearFirestore()
    const clients = Object.fromEntries(
      ['alice', 'bob', 'staff'].map((uid) => [
        uid,
        {
          db: env.authenticatedContext(uid, { email: uid + '@example.com' }).firestore(),
          auth: { currentUser: { uid, email: uid + '@example.com' } },
        },
      ]),
    )
    const anon = env.unauthenticatedContext().firestore()
    const action = (who, name, data) => runAction(clients[who].db, clients[who].auth, name, data)
    try {
      await t.test('real account document requires a unique permanent username', async () => {
        for (const uid of ['alice', 'bob', 'staff'])
          await action(uid, 'register', { name: uid, username: uid + '-user' })
        await assertFails(setDoc(doc(clients.bob.db, 'users', 'alice'), { closed: false }))
        await assertFails(setDoc(doc(clients.alice.db, 'admins', 'alice'), { enabled: true }))
        await assertFails(setDoc(doc(clients.bob.db, 'usernames', 'alice-user'), { uid: 'bob' }))
        await assertFails(getDoc(doc(anon, 'users', 'alice')))
        await env.withSecurityRulesDisabled(async (context) =>
          setDoc(doc(context.firestore(), 'admins', 'staff'), { enabled: true }),
        )
        await action('staff', 'initializeCatalog')
        await assert.rejects(action('alice', 'initializeCatalog'), /Administrator/)
      })
      const profile = {
        ...emptyProfile('Personal'),
        name: 'Alice',
        username: 'alice-user',
        email: 'private@example.com',
        phone: '+63 917 123 4567',
        website: 'https://example.com',
        privacy: { email: 'Hidden', phone: 'Request access', website: 'Public' },
        contactBack: true,
        sections: [
          { id: 'private', type: 'About', body: 'Secret', hidden: true },
          { id: 'visible', type: 'About', body: 'Hello', hidden: false },
        ],
      }
      await t.test(
        'public projection strips hidden data and rejects a forged projection',
        async () => {
          await action('alice', 'saveWorkspace', {
            change: {
              drafts: { Personal: profile, Professional: emptyProfile('Professional') },
              published: { Personal: profile, Professional: null },
            },
            profileModes: { drafts: ['Personal'], published: ['Personal'] },
          })
          const publication = await getDoc(
            doc(anon, 'publicProfiles', 'alice-user', 'modes', 'Personal'),
          )
          assert.equal(publication.data().profile.email, '')
          assert.equal(publication.data().profile.phone, '')
          assert.equal(publication.data().profile.sections.length, 1)
          await assertFails(
            setDoc(doc(clients.alice.db, 'publicProfiles', 'alice-user', 'modes', 'Personal'), {
              uid: 'alice',
              profile,
              updatedAt: serverTimestamp(),
            }),
          )
          await assertFails(getDoc(doc(clients.bob.db, 'users', 'alice', 'profiles', 'Personal')))
          await assertFails(
            updateDoc(doc(clients.bob.db, 'users', 'alice', 'profiles', 'Personal'), {
              draft: profile,
            }),
          )
        },
      )
      await t.test(
        'mode-specific writes preserve the other mode and require publishing before activation',
        async () => {
          const professional = { ...profile, title: 'Designer', name: 'Alice Pro' }
          await assert.rejects(
            action('alice', 'saveWorkspace', { change: { active: 'Professional' } }),
            /Publish/,
          )
          await action('alice', 'saveWorkspace', {
            change: {
              drafts: { Personal: emptyProfile('Personal'), Professional: professional },
              published: { Personal: null, Professional: professional },
            },
            profileModes: { drafts: ['Professional'], published: ['Professional'] },
          })
          assert.equal(
            (await getDoc(doc(clients.alice.db, 'users', 'alice', 'profiles', 'Personal'))).data()
              .draft.name,
            'Alice',
          )
          await action('alice', 'saveWorkspace', { change: { active: 'Professional' } })
          assert.equal(
            (await getDoc(doc(anon, 'publicProfiles', 'alice-user'))).data().active,
            'Professional',
          )
        },
      )
      let card
      await t.test(
        'activation secrets cannot be read, guessed or reused by another customer',
        async () => {
          card = await action('staff', 'generateCard', { name: 'Test card', tone: 'chalk' })
          await assertFails(getDoc(doc(clients.alice.db, 'cardSecrets', card.id)))
          await assertFails(action('alice', 'claimCard', { id: card.id, code: 'wrong' }))
          await action('alice', 'claimCard', { id: card.id, code: card.activationCode })
          await assert.rejects(
            action('bob', 'claimCard', { id: card.id, code: card.activationCode }),
            /unavailable/,
          )
          await assertFails(action('bob', 'cardStatus', { id: card.id, name: 'Stolen' }))
          await action('alice', 'cardStatus', { id: card.id, name: 'My card' })
        },
      )
      const imageId = 'alice-receipt',
        image = imagePrefix + imageId
      await t.test('compressed images stay private until the owner publishes them', async () => {
        await setDoc(doc(clients.alice.db, 'images', imageId), {
          ownerUid: 'alice',
          data: 'data:image/webp;base64,AAAA',
          public: false,
          createdAt: serverTimestamp(),
        })
        await assertFails(getDoc(doc(anon, 'images', imageId)))
        await assertFails(getDoc(doc(clients.bob.db, 'images', imageId)))
        await assertFails(
          setDoc(doc(clients.alice.db, 'images', 'oversized'), {
            ownerUid: 'alice',
            data: 'data:image/webp;base64,' + 'A'.repeat(180000),
            public: false,
            createdAt: serverTimestamp(),
          }),
        )
        const withAvatar = { ...profile, avatar: image }
        await action('alice', 'saveWorkspace', {
          change: { published: { Personal: withAvatar, Professional: null } },
          profileModes: { published: ['Personal'] },
        })
        await assertSucceeds(getDoc(doc(anon, 'images', imageId)))
      })
      let order
      await t.test(
        'catalog prices override submitted prices and tampering is rejected by rules',
        async () => {
          const input = {
            requestId: 'test-order-0001',
            shippingName: 'Alice',
            address: 'Rodriguez, Rizal',
            phone: '+63 917 123 4567',
            items: [{ productId: 'classic', quantity: 2, price: 0.01 }],
          }
          order = await action('alice', 'placeOrder', input)
          assert.equal(order.total, 998)
          assert.equal((await action('alice', 'placeOrder', input)).id, order.id)
          await assertFails(
            setDoc(doc(clients.alice.db, 'orders', 'TAP-tampered'), {
              ...order,
              id: 'TAP-tampered',
              total: 0.01,
              createdAt: serverTimestamp(),
            }),
          )
          await assertFails(
            setDoc(doc(clients.alice.db, 'orders', 'TAP-forged-price'), {
              ...order,
              id: 'TAP-forged-price',
              total: 0.02,
              items: [{ ...order.items[0], price: 0.01 }],
              createdAt: serverTimestamp(),
            }),
          )
          await assertFails(getDoc(doc(clients.bob.db, 'orders', order.id)))
          await assert.rejects(
            action('alice', 'placeOrder', {
              ...input,
              requestId: 'custom-blank',
              items: [{ productId: 'custom', quantity: 1, design: { name: ' ' } }],
            }),
            /name/,
          )
        },
      )
      await t.test(
        'only admin can verify proof, deduct stock once and ship paid orders',
        async () => {
          await updateDoc(doc(clients.staff.db, 'products', 'classic'), { stock: 10 })
          await assert.rejects(
            action('alice', 'orderStatus', { id: order.id, key: 'payment', value: 'Paid' }),
            /unverified/,
          )
          await assert.rejects(
            action('staff', 'orderStatus', { id: order.id, key: 'shipping', value: 'Shipped' }),
            /payment/,
          )
          await action('alice', 'orderStatus', { id: order.id, key: 'paymentProof', value: image })
          await assertFails(
            action('alice', 'orderStatus', { id: order.id, key: 'payment', value: 'Paid' }),
          )
          await action('staff', 'orderStatus', { id: order.id, key: 'payment', value: 'Paid' })
          assert.equal((await getDoc(doc(clients.staff.db, 'products', 'classic'))).data().stock, 8)
          await assert.rejects(
            action('staff', 'orderStatus', { id: order.id, key: 'payment', value: 'Paid' }),
            /unverified/,
          )
          await assertFails(
            action('alice', 'orderStatus', { id: order.id, key: 'shipping', value: 'Shipped' }),
          )
          await action('staff', 'orderStatus', { id: order.id, key: 'shipping', value: 'Shipped' })
        },
      )
      await t.test(
        'chat is private and customers cannot impersonate an administrator',
        async () => {
          await action('alice', 'sendMessage', { id: 'hello-0001', text: 'Hello', image: '' })
          const thread = await getDocs(
            query(collection(clients.alice.db, 'messages'), where('ownerUid', '==', 'alice')),
          )
          assert.equal(thread.size, 1)
          await assertFails(getDoc(doc(clients.bob.db, 'messages', thread.docs[0].id)))
          await assertFails(
            setDoc(doc(clients.alice.db, 'messages', 'spoof'), {
              id: 'spoof',
              ownerUid: 'bob',
              authorUid: 'alice',
              sender: 'admin',
              text: 'Fake',
              image: '',
              createdAt: serverTimestamp(),
            }),
          )
          await action('staff', 'sendMessage', {
            id: 'reply-0001',
            ownerUid: 'alice',
            text: 'How can I help?',
            image: '',
          })
          await action('alice', 'sendMessage', { id: 'hello-0001', text: 'Hello', image: '' })
          assert.equal(
            (
              await getDocs(
                query(collection(clients.alice.db, 'messages'), where('ownerUid', '==', 'alice')),
              )
            ).size,
            2,
          )
        },
      )
      await t.test(
        'anonymous contact requests only work for an opted-in published owner',
        async () => {
          await runAction(anon, { currentUser: null }, 'contact', {
            username: 'alice-user',
            name: 'Visitor',
            email: 'visitor@example.com',
          })
          await assertFails(getDocs(collection(anon, 'contactRequests')))
          await assert.rejects(
            runAction(anon, { currentUser: null }, 'contact', {
              username: 'bob-user',
              name: 'Visitor',
              email: 'visitor@example.com',
            }),
            /unavailable/,
          )
        },
      )
      await t.test(
        'eight designs keep their catalog total and reject a bad last line',
        async () => {
          const input = {
            requestId: 'many-designs-0001',
            shippingName: 'Alice',
            address: 'Rizal',
            phone: '09171234567',
            items: Array.from({ length: 8 }, () => ({ productId: 'matte', quantity: 1 })),
          }
          const big = await action('alice', 'placeOrder', input)
          assert.equal(big.total, 649 * 8)
          const items = big.items.map((item, i) => (i === 7 ? { ...item, price: 0.01 } : item))
          await assertFails(
            setDoc(doc(clients.alice.db, 'orders', 'TAP-bad-last'), {
              ...big,
              id: 'TAP-bad-last',
              items,
              total: 7 * 649 + 0.01,
              createdAt: serverTimestamp(),
            }),
          )
        },
      )
      await t.test(
        'a full 40-section profile can publish without exposing hidden sections',
        async () => {
          const full = {
            ...profile,
            sections: Array.from({ length: 40 }, (_, i) => ({
              id: 'section-' + i,
              type: 'About',
              body: 'Section ' + i,
              hidden: false,
            })),
          }
          await action('alice', 'saveWorkspace', {
            change: { published: { Personal: full, Professional: null } },
            profileModes: { published: ['Personal'] },
          })
          assert.equal(
            (await getDoc(doc(anon, 'publicProfiles', 'alice-user', 'modes', 'Personal'))).data()
              .profile.sections.length,
            40,
          )
        },
      )
      await t.test(
        'account closure hides both modes, disables cards and revokes image access',
        async () => {
          await action('alice', 'closeAccount')
          assert.equal((await getDoc(doc(anon, 'publicProfiles', 'alice-user'))).exists(), false)
          assert.equal(
            (await getDoc(doc(anon, 'publicProfiles', 'alice-user', 'modes', 'Personal'))).exists(),
            false,
          )
          assert.equal((await getDoc(doc(anon, 'cards', card.id))).data().status, 'Disabled')
          await assertFails(getDoc(doc(anon, 'images', imageId)))
          await assert.rejects(
            action('alice', 'saveWorkspace', { change: { active: 'Personal' } }),
            /unavailable/,
          )
        },
      )
    } finally {
      await env.cleanup()
    }
  },
)

test(
  'Email/password sign-up and sign-in persist a real Firebase UID',
  { skip: !process.env.FIREBASE_AUTH_EMULATOR_HOST, timeout: 30000 },
  async () => {
    const { initializeApp, deleteApp } = await import('firebase/app')
    const {
      getAuth,
      connectAuthEmulator,
      createUserWithEmailAndPassword,
      signOut,
      signInWithEmailAndPassword,
    } = await import('firebase/auth')
    const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore')
    const app = initializeApp(
      { apiKey: 'fake-emulator-key', projectId: 'tap-io-517cd' },
      'spark-auth-check',
    )
    const auth = getAuth(app),
      db = getFirestore(app)
    connectAuthEmulator(auth, 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST, {
      disableWarnings: true,
    })
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
    connectFirestoreEmulator(db, host, Number(port))
    try {
      const email = 'auth-' + Date.now() + '@example.com',
        username = 'auth-' + Date.now(),
        password = 'TemporaryTest!123'
      const created = await createUserWithEmailAndPassword(auth, email, password)
      await runAction(db, auth, 'register', { name: 'Auth Tester', username })
      const uid = created.user.uid
      await signOut(auth)
      await assert.rejects(signInWithEmailAndPassword(auth, email, 'IncorrectPassword'))
      await signInWithEmailAndPassword(auth, email, password)
      assert.equal(auth.currentUser.uid, uid)
      assert.equal((await getDoc(doc(db, 'users', uid))).data().account.username, username)
      await assert.rejects(createUserWithEmailAndPassword(auth, email, password))
    } finally {
      await deleteApp(app)
    }
  },
)
