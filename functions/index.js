import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage, getDownloadURL } from 'firebase-admin/storage'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { modes, validUsername, publicProfile, priceOrder } from './domain.js'

initializeApp()
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 5 })
const db = getFirestore()
const bucketName = 'tap-io-517cd.firebasestorage.app'
const emulatorStorage = process.env.FIREBASE_STORAGE_EMULATOR_HOST
const storageOrigin = emulatorStorage
  ? 'http://' + emulatorStorage
  : 'https://firebasestorage.googleapis.com'
const date = () => new Date().toISOString()
const clean = (value) => JSON.parse(JSON.stringify(value))
const digest = (value) => createHash('sha256').update(value).digest('hex')
function fail(message, code = 'invalid-argument') {
  throw new HttpsError(code, message)
}
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    fail('Enter a valid value (maximum ' + max + ' characters).')
  return value.trim()
}
function uid(request) {
  if (!request.auth) fail('Sign in to continue.', 'unauthenticated')
  return request.auth.uid
}
async function isAdmin(id) {
  return (await db.doc('admins/' + id).get()).data()?.enabled === true
}
async function requireAdmin(request) {
  const id = uid(request)
  if (!(await isAdmin(id))) fail('Administrator access is required.', 'permission-denied')
  return id
}
async function userRecord(request) {
  const id = uid(request)
  const user = await db.doc('users/' + id).get()
  if (!user.exists) fail('Complete your account setup first.', 'failed-precondition')
  if (user.data().closed) fail('This account has been closed.', 'permission-denied')
  return { id, ...user.data() }
}
async function publicImages(value, ownerUid) {
  if (typeof value === 'string' && value.startsWith(storageOrigin + '/')) {
    const url = new URL(value)
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/)
    if (!match) return value
    const path = decodeURIComponent(match[2])
    const bucket = getStorage().bucket(decodeURIComponent(match[1]))
    if (bucket.name !== bucketName) fail('Use images uploaded to this website.')
    if (path.startsWith('public/' + ownerUid + '/')) return value
    if (!path.startsWith('private/' + ownerUid + '/'))
      fail('You can only publish your own uploaded images.', 'permission-denied')
    const target = bucket.file('public/' + ownerUid + '/' + path.split('/').pop())
    if (!(await target.exists())[0]) {
      await bucket.file(path).copy(target)
      await target.setMetadata({ metadata: { firebaseStorageDownloadTokens: randomUUID() } })
    }
    return getDownloadURL(target)
  }
  if (Array.isArray(value)) return Promise.all(value.map((item) => publicImages(item, ownerUid)))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([key, item]) => [key, await publicImages(item, ownerUid)]),
      ),
    )
  return value
}
function validateProfiles(profiles) {
  if (!profiles || typeof profiles !== 'object') fail('Invalid profiles.')
  for (const mode of modes) {
    const p = profiles[mode]
    if (p === null) continue
    if (
      !p ||
      !Array.isArray(p.sections) ||
      !Array.isArray(p.links) ||
      !Array.isArray(p.buttons) ||
      p.sections.length > 40 ||
      p.links.length > 60 ||
      p.buttons.length > 60
    )
      fail('Invalid profile sections or links.')
    text(p.name, 100)
    text(p.bio || '', 160)
    if (JSON.stringify(p).length > 500000)
      fail('This profile is too large. Reduce the number of images or sections.')
    for (const item of [...p.links, ...p.buttons, ...p.sections, { url: p.website }]) {
      if (item.url) {
        try {
          if (!['https:', 'http:'].includes(new URL(item.url).protocol))
            fail('Use an HTTPS or HTTP link.')
        } catch {
          fail('Enter a complete website URL.')
        }
      }
    }
  }
}
async function register(request) {
  const id = uid(request)
  const name = text(request.data.name, 100, true)
  const username = text(request.data.username, 24, true).toLowerCase()
  if (!validUsername(username))
    fail('Use 3–24 lowercase letters, numbers, or hyphens. Start with a letter.')
  return db.runTransaction(async (transaction) => {
    const own = db.doc('users/' + id),
      reservation = db.doc('usernames/' + username)
    const [existing, taken] = await Promise.all([
      transaction.get(own),
      transaction.get(reservation),
    ])
    if (existing.exists) return existing.data()
    if (taken.exists) fail('That username is already in use.', 'already-exists')
    const blank = (mode) => ({
      name,
      username,
      title: '',
      company: '',
      bio: '',
      location: '',
      email: mode === 'Professional' ? request.auth.token.email || '' : '',
      phone: '',
      website: '',
      avatar: '',
      cover: '',
      backgroundImage: '',
      theme: 'Light',
      background: 'Solid',
      color: '#f1f0ed',
      text: '#161619',
      accent: '#5267e8',
      card: '#ffffff',
      border: '#dddddf',
      button: '#5267e8',
      font: 'Inter',
      shape: 'Rounded',
      layout: 'Stack',
      sections: [
        { id: randomUUID(), type: 'About', body: '', hidden: false },
        { id: randomUUID(), type: 'Social Links', body: '', hidden: false },
        ...(mode === 'Professional'
          ? [{ id: randomUUID(), type: 'Contact Information', body: '', hidden: false }]
          : []),
      ],
      links: [],
      buttons: [],
    })
    const user = {
      account: {
        name,
        username,
        email: request.auth.token.email || '',
        uid: id,
        createdAt: date(),
      },
      active: 'Personal',
      drafts: { Personal: blank('Personal'), Professional: blank('Professional') },
      published: { Personal: null, Professional: null },
      cart: {},
      cartDesigns: {},
      messageRead: {},
      checklistHidden: false,
    }
    transaction.create(reservation, { uid: id })
    transaction.create(own, user)
    return user
  })
}
async function saveWorkspace(request) {
  const user = await userRecord(request)
  const change = request.data.change
  if (!change || typeof change !== 'object') fail('Invalid changes.')
  const allowed = [
    'account',
    'active',
    'drafts',
    'published',
    'cart',
    'cartDesigns',
    'checklistHidden',
    'messageRead',
  ]
  if (Object.keys(change).some((key) => !allowed.includes(key)))
    fail('This field cannot be edited.', 'permission-denied')
  if (change.account) {
    if (
      change.account.username !== user.account.username ||
      change.account.uid !== user.id ||
      change.account.email !== user.account.email
    )
      fail('The username and email belong to your account and cannot be changed here.')
    change.account = {
      ...user.account,
      name: text(change.account.name, 100, true),
      shared: Boolean(change.account.shared),
      notifications: Boolean(change.account.notifications),
    }
  }
  if (change.drafts) validateProfiles(change.drafts)
  if (change.published) {
    validateProfiles(change.published)
    for (const mode of modes)
      if (change.published[mode]) text(change.published[mode].name, 100, true)
  }
  if (change.active && !modes.includes(change.active)) fail('Invalid profile mode.')
  // Prepare only public content. Hidden contact fields never enter the public document.
  const projections = {}
  if (change.published) {
    for (const mode of modes)
      projections[mode] = change.published[mode]
        ? await publicImages(publicProfile(change.published[mode]), user.id)
        : null
  }
  return db.runTransaction(async (transaction) => {
    const own = db.doc('users/' + user.id),
      publicRef = db.doc('publicProfiles/' + user.account.username)
    const [latest, previousPublic] = await Promise.all([
      transaction.get(own),
      transaction.get(publicRef),
    ])
    if (latest.data()?.closed) fail('This account is closed.', 'permission-denied')
    const next = { ...latest.data(), ...change }
    if (change.active && !next.published[change.active])
      fail('Publish this mode before activating it.')
    transaction.update(own, clean(change))
    if (change.published || change.active) {
      const previous = previousPublic.data()?.profiles || {}
      const profile = (change.published ? projections : previous)[next.active] || null
      transaction.set(publicRef, {
        uid: user.id,
        username: user.account.username,
        active: next.active,
        profile,
        profiles: change.published ? projections : previous,
        updatedAt: date(),
      })
    }
    return clean(change)
  })
}
async function generateCard(request) {
  await requireAdmin(request)
  const id = 'TAP-' + randomBytes(10).toString('hex').toUpperCase()
  const code = randomBytes(16).toString('hex').toUpperCase()
  const tone = ['chalk', 'onyx', 'cobalt'].includes(request.data.tone) ? request.data.tone : 'chalk'
  const card = {
    id,
    name: text(request.data.name || 'tap.io card', 100, true),
    tone,
    status: 'Unclaimed',
    owner: '',
    ownerUid: '',
    activated: '',
  }
  const batch = db.batch()
  batch.create(db.doc('cards/' + id), card)
  batch.create(db.doc('cardSecrets/' + id), { hash: digest(code) })
  await batch.commit()
  return { ...card, activationCode: code }
}
async function claimCard(request) {
  const user = await userRecord(request)
  const id = text(request.data.id, 80, true),
    code = text(request.data.code, 100, true).toUpperCase()
  const attempt = db.doc('claimAttempts/' + user.id)
  await db.runTransaction(async (transaction) => {
    const previous = (await transaction.get(attempt)).data()
    const within = previous && Date.now() - previous.start < 3600000
    if (within && previous.count >= 10)
      fail('Too many activation attempts. Try again in an hour.', 'resource-exhausted')
    transaction.set(attempt, {
      start: within ? previous.start : Date.now(),
      count: within ? previous.count + 1 : 1,
    })
  })
  return db.runTransaction(async (transaction) => {
    const ref = db.doc('cards/' + id),
      secret = db.doc('cardSecrets/' + id)
    const [snapshot, key] = await Promise.all([transaction.get(ref), transaction.get(secret)])
    if (snapshot.data()?.ownerUid === user.id) return snapshot.data()
    if (!snapshot.exists || snapshot.data().status !== 'Unclaimed' || !key.exists)
      fail('This card is unavailable.', 'failed-precondition')
    if (!timingSafeEqual(Buffer.from(digest(code), 'hex'), Buffer.from(key.data().hash, 'hex')))
      fail('The activation code is incorrect.')
    const card = {
      ...snapshot.data(),
      ownerUid: user.id,
      owner: user.account.username,
      status: 'Claimed',
      activated: date().slice(0, 10),
    }
    transaction.set(ref, card)
    transaction.delete(secret)
    return card
  })
}
async function cardStatus(request) {
  const user = await userRecord(request),
    admin = await isAdmin(user.id)
  const ref = db.doc('cards/' + text(request.data.id, 80, true))
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists || (!admin && snapshot.data().ownerUid !== user.id))
      fail('Card access denied.', 'permission-denied')
    const patch =
      request.data.name !== undefined
        ? { name: text(request.data.name, 100, true) }
        : { status: request.data.status }
    if (patch.status && !['Claimed', 'Disabled'].includes(patch.status))
      fail('Invalid card status.')
    if (patch.status === 'Claimed' && !snapshot.data().ownerUid)
      fail('Claim this card with its activation code first.')
    transaction.update(ref, patch)
    return { ...snapshot.data(), ...patch }
  })
}
async function placeOrder(request) {
  const user = await userRecord(request)
  const requestId = text(request.data.requestId, 80, true)
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(requestId)) fail('Invalid order reference.')
  const id = 'TAP-' + requestId
  const lines = request.data.items
  if (!Array.isArray(lines) || !lines.length || lines.length > 40)
    fail('Select up to 40 card designs per order.')
  const shipping = {
    name: text(request.data.shippingName, 100, true),
    address: text(request.data.address, 1000, true),
    phone: text(request.data.phone, 25, true),
  }
  if (!/^\+?[\d ()-]{7,25}$/.test(shipping.phone)) fail('Enter a valid phone number.')
  return db.runTransaction(async (transaction) => {
    const ref = db.doc('orders/' + id),
      existing = await transaction.get(ref)
    if (existing.exists) {
      if (existing.data().ownerUid !== user.id) fail('Invalid order reference.')
      return existing.data()
    }
    const products = new Map()
    for (const productId of new Set(lines.map((item) => text(item.productId, 100, true))))
      products.set(productId, (await transaction.get(db.doc('products/' + productId))).data())
    let priced
    try {
      priced = priceOrder(lines, products)
    } catch (error) {
      fail(error.message)
    }
    const order = {
      id,
      ownerUid: user.id,
      customerId: user.account.username,
      customer: shipping.name,
      shippingDetails: shipping,
      ...clean(priced),
      payment: 'Pending',
      shipping: 'Pending',
      date: date().slice(0, 10),
      createdAt: date(),
    }
    transaction.create(ref, order)
    return order
  })
}
function ownImage(value, ownerUid) {
  if (!value) return ''
  try {
    const url = new URL(value)
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/)
    if (
      url.origin !== storageOrigin ||
      !match ||
      decodeURIComponent(match[1]) !== bucketName ||
      !decodeURIComponent(match[2]).startsWith('private/' + ownerUid + '/')
    )
      fail('Upload an image from your own account.')
  } catch {
    fail('Upload a valid image from your own account.')
  }
  return value
}
async function orderStatus(request) {
  const user = await userRecord(request),
    admin = await isAdmin(user.id)
  const id = text(request.data.id, 100, true),
    ref = db.doc('orders/' + id)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref),
      order = snapshot.data()
    if (!order || (!admin && order.ownerUid !== user.id))
      fail('Order access denied.', 'permission-denied')
    const { key, value } = request.data
    if (key === 'paymentProof') {
      if (order.payment === 'Paid') fail('This payment is already verified.')
      if (typeof value !== 'string' || value.length > 4096) fail('Invalid payment proof.')
      ownImage(value, user.id)
      transaction.update(ref, { paymentProof: value, payment: 'Pending' })
      return { ...order, paymentProof: value, payment: 'Pending' }
    }
    if (!admin) fail('Only an administrator can process orders.', 'permission-denied')
    if (key === 'shipping') {
      if (
        order.payment !== 'Paid' ||
        !['Pending', 'Packing', 'Shipped', 'Delivered'].includes(value)
      )
        fail('Verify payment before processing shipment.')
    } else if (key === 'payment') {
      if (!['Paid', 'Rejected'].includes(value) || !order.paymentProof || order.payment === 'Paid')
        fail('Review an unverified payment proof first.')
      if (value === 'Paid') {
        const quantities = new Map()
        for (const item of order.items)
          quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity)
        const inventory = []
        for (const [productId, quantity] of quantities) {
          const productRef = db.doc('products/' + productId),
            product = (await transaction.get(productRef)).data()
          if (product?.stock !== undefined) {
            if (product.stock < quantity)
              fail('Insufficient stock. Update inventory before verifying this order.')
            inventory.push([productRef, product.stock - quantity])
          }
        }
        for (const [productRef, stock] of inventory) transaction.update(productRef, { stock })
      }
    } else fail('Invalid order update.')
    transaction.update(ref, { [key]: value })
    return { ...order, [key]: value }
  })
}
async function saveProduct(request) {
  const id = await requireAdmin(request),
    input = request.data.product
  const product = {
    id: input.id ? text(input.id, 100, true) : randomUUID(),
    name: text(input.name, 100, true),
    description: text(input.description || '', 2000),
    colors: text(input.colors || '', 100),
    tone: input.tone,
    price: input.price,
    available: Boolean(input.available),
  }
  if (
    !['chalk', 'onyx', 'cobalt'].includes(product.tone) ||
    !Number.isFinite(product.price) ||
    product.price < 0
  )
    fail('Choose a valid finish and price.')
  if (input.stock !== undefined) {
    if (!Number.isSafeInteger(input.stock) || input.stock < 0)
      fail('Stock must be a nonnegative whole number.')
    product.stock = input.stock
  }
  await db.doc('products/' + product.id).set(await publicImages(product, id))
  return product
}
async function sendMessage(request) {
  const user = await userRecord(request),
    admin = await isAdmin(user.id)
  const ownerUid = admin ? text(request.data.ownerUid, 128, true) : user.id
  const message = {
    id: text(request.data.id, 100, true),
    ownerUid,
    sender: admin ? 'admin' : 'customer',
    authorUid: user.id,
    text: text(request.data.text || '', 2000),
    image: ownImage(text(request.data.image || '', 4096), user.id),
    createdAt: date(),
  }
  if (!message.text && !message.image) fail('Enter a message or attach an image.')
  if (!(await db.doc('users/' + ownerUid).get()).exists) fail('Customer not found.')
  const ref = db.doc('messages/' + user.id + '-' + message.id)
  await db.runTransaction(async (transaction) => {
    if (!(await transaction.get(ref)).exists) transaction.create(ref, message)
  })
  return message
}
async function contact(request) {
  const username = text(request.data.username, 24, true)
  const target = (await db.doc('publicProfiles/' + username).get()).data()
  if (
    !target?.profile ||
    (!target.profile.contactBack &&
      !Object.values(target.profile.privacy || {}).includes('Request access'))
  )
    fail('Contact requests are unavailable.')
  const name = text(request.data.name, 100, true),
    email = text(request.data.email, 254, true)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email.')
  const rate = db.doc('contactRateLimits/' + digest(request.rawRequest.ip || 'unknown'))
  await db.runTransaction(async (transaction) => {
    const previous = (await transaction.get(rate)).data()
    if (previous && Date.now() - previous.start < 3600000 && previous.count >= 5)
      fail('Too many requests. Try again in an hour.', 'resource-exhausted')
    const within = previous && Date.now() - previous.start < 3600000
    transaction.set(rate, {
      start: within ? previous.start : Date.now(),
      count: within ? previous.count + 1 : 1,
    })
    transaction.create(db.collection('contactRequests').doc(), {
      name,
      email,
      ownerUid: target.uid,
      request: text(request.data.request || 'Share contact', 100),
      date: date().slice(0, 10),
    })
  })
  return { sent: true }
}
async function initializeCatalog(request) {
  await requireAdmin(request)
  const products = [
    {
      id: 'classic',
      name: 'tap.io Classic',
      price: 499,
      description: 'An ivory card with a soft-touch finish.',
      colors: 'Chalk',
      tone: 'chalk',
      available: true,
    },
    {
      id: 'matte',
      name: 'tap.io Matte Black',
      price: 649,
      description: 'A low-gloss black finish with a gold foil name.',
      colors: 'Onyx',
      tone: 'onyx',
      available: true,
    },
    {
      id: 'custom',
      name: 'tap.io Custom',
      price: 899,
      description: 'Your name, your colors, and your logo.',
      colors: 'Cobalt',
      tone: 'cobalt',
      available: true,
    },
  ]
  await db.runTransaction(async (transaction) => {
    const existing = await Promise.all(
      products.map((product) => transaction.get(db.doc('products/' + product.id))),
    )
    products.forEach((product, index) => {
      if (!existing[index].exists) transaction.create(db.doc('products/' + product.id), product)
    })
  })
  return { saved: true }
}
async function track(request) {
  const username = text(request.data.username, 24, true),
    event = request.data.event
  if (!['taps', 'links', 'contacts'].includes(event)) fail('Invalid activity.')
  const target = (await db.doc('publicProfiles/' + username).get()).data()
  if (!target?.profile) return { recorded: false }
  const day = date().slice(0, 10)
  const seen = db.doc(
    'analyticsEvents/' + digest((request.rawRequest.ip || 'unknown') + username + day + event),
  )
  return db.runTransaction(async (transaction) => {
    if ((await transaction.get(seen)).exists) return { recorded: false }
    transaction.create(seen, { day })
    transaction.set(
      db.doc('analytics/' + target.uid + '/days/' + day),
      { [event]: FieldValue.increment(1) },
      { merge: true },
    )
    return { recorded: true }
  })
}
const actions = {
  track,
  register,
  saveWorkspace,
  generateCard,
  claimCard,
  cardStatus,
  placeOrder,
  orderStatus,
  saveProduct,
  sendMessage,
  contact,
  initializeCatalog,
  async paymentSettings(request) {
    const id = await requireAdmin(request)
    const paymentDetails = {
      number: text(request.data.number || '', 30),
      qr: await publicImages(text(request.data.qr || '', 4096), id),
    }
    await db.doc('settings/store').set({ paymentDetails })
    return paymentDetails
  },
  async requestTransfer(request) {
    const user = await userRecord(request)
    const card = (await db.doc('cards/' + text(request.data.id, 80, true)).get()).data()
    if (card?.ownerUid !== user.id) fail('Card access denied.', 'permission-denied')
    await db
      .doc('transferRequests/' + card.id)
      .set({ cardId: card.id, ownerUid: user.id, createdAt: date(), status: 'Pending' })
    return { sent: true }
  },
  async closeAccount(request) {
    const user = await userRecord(request)
    const batch = db.batch()
    batch.update(db.doc('users/' + user.id), {
      closed: true,
      published: { Personal: null, Professional: null },
    })
    batch.delete(db.doc('publicProfiles/' + user.account.username))
    batch.delete(db.doc('admins/' + user.id))
    const cards = await db.collection('cards').where('ownerUid', '==', user.id).get()
    for (const card of cards.docs) batch.update(card.ref, { status: 'Disabled' })
    await batch.commit()
    return { closed: true }
  },
}
export const tapio = onCall({ cors: true }, async (request) => {
  const action = Object.hasOwn(actions, request.data?.action) ? actions[request.data.action] : null
  if (!action) fail('Unknown operation.')
  try {
    return clean(await action(request))
  } catch (error) {
    if (error instanceof HttpsError) throw error
    console.error('tapio operation failed', request.data?.action, error.code || error.message)
    throw new HttpsError('internal', 'Could not save this change. Please try again.')
  }
})
