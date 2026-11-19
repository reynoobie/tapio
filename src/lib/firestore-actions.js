import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  writeBatch,
  setDoc,
} from 'firebase/firestore'
import { emptyProfile } from '../data.js'
import { modes, publicProfile, priceOrder, validUsername } from './domain.js'

export const imagePrefix = 'tapio-image:'
export const MAX_IMAGE_CHARACTERS = 180000
const timestamp = () => new Date().toISOString()
const clean = (value) => JSON.parse(JSON.stringify(value))
const text = (value, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    throw new Error('Enter a valid value (maximum ' + max + ' characters).')
  return value.trim()
}
export async function hashText(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
export function imageIds(value) {
  if (typeof value === 'string')
    return value.startsWith(imagePrefix) ? [value.slice(imagePrefix.length)] : []
  if (Array.isArray(value)) return value.flatMap(imageIds)
  if (value && typeof value === 'object') return Object.values(value).flatMap(imageIds)
  return []
}
function validateProfile(profile) {
  if (profile === null) return
  if (
    !profile ||
    !Array.isArray(profile.sections) ||
    !Array.isArray(profile.links) ||
    !Array.isArray(profile.buttons) ||
    profile.sections.length > 40 ||
    profile.links.length > 60 ||
    profile.buttons.length > 60
  )
    throw new Error('Invalid profile sections or links.')
  text(profile.name, 100)
  text(profile.bio || '', 160)
  if (new TextEncoder().encode(JSON.stringify(profile)).length > 350000)
    throw new Error('This profile is too large. Reduce its text or number of sections.')
}
export async function runAction(db, auth, action, data = {}) {
  const userId = () => {
    if (!auth.currentUser) throw new Error('Sign in to continue.')
    return auth.currentUser.uid
  }
  const admin = async () => {
    const id = userId()
    if ((await getDoc(doc(db, 'admins', id))).data()?.enabled !== true)
      throw new Error('Administrator access is required.')
    return id
  }
  const userRecord = async () => {
    const id = userId(),
      snapshot = await getDoc(doc(db, 'users', id))
    if (!snapshot.exists()) throw new Error('Complete your account setup first.')
    if (snapshot.data().closed) throw new Error('This account is closed.')
    return { id, ...snapshot.data() }
  }
  if (action === 'register') {
    const id = userId(),
      name = text(data.name, 100, true),
      username = text(data.username, 24, true).toLowerCase()
    if (!validUsername(username))
      throw new Error('Use 3–24 lowercase letters, numbers, or hyphens. Start with a letter.')
    return runTransaction(db, async (transaction) => {
      const own = doc(db, 'users', id),
        reservation = doc(db, 'usernames', username)
      const [existing, taken] = await Promise.all([
        transaction.get(own),
        transaction.get(reservation),
      ])
      if (existing.exists()) return existing.data()
      if (taken.exists()) throw new Error('That username is already in use.')
      const drafts = Object.fromEntries(
        modes.map((mode) => [
          mode,
          {
            ...emptyProfile(mode),
            name,
            username,
            email: mode === 'Professional' ? auth.currentUser.email || '' : '',
          },
        ]),
      )
      const user = {
        account: {
          uid: id,
          name,
          username,
          email: auth.currentUser.email || '',
          createdAt: timestamp(),
        },
        active: 'Personal',
        cart: {},
        cartDesigns: {},
        messageRead: {},
        checklistHidden: false,
        closed: false,
      }
      transaction.set(reservation, { uid: id })
      transaction.set(own, user)
      for (const mode of modes)
        transaction.set(doc(db, 'users', id, 'profiles', mode), {
          draft: drafts[mode],
          published: null,
        })
      return { ...user, drafts, published: { Personal: null, Professional: null } }
    })
  }
  if (action === 'saveWorkspace') {
    const id = userId(),
      change = clean(data.change),
      allowed = [
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
      throw new Error('This field cannot be edited.')
    for (const field of ['drafts', 'published'])
      if (change[field])
        for (const mode of modes) {
          validateProfile(change[field][mode])
          if (field === 'published' && change[field][mode])
            text(change[field][mode].name, 100, true)
        }
    return runTransaction(db, async (transaction) => {
      const own = doc(db, 'users', id)
      const latest = await transaction.get(own)
      if (!latest.exists() || latest.data().closed) throw new Error('Your account is unavailable.')
      const user = latest.data(),
        username = user.account.username
      const profileRefs = modes.map((mode) => doc(db, 'users', id, 'profiles', mode))
      const snapshots = await Promise.all(profileRefs.map((ref) => transaction.get(ref)))
      const drafts = Object.fromEntries(
        modes.map((mode, index) => [mode, snapshots[index].data().draft]),
      )
      const published = Object.fromEntries(
        modes.map((mode, index) => [mode, snapshots[index].data().published]),
      )
      const patch = { ...change }
      delete patch.drafts
      delete patch.published
      if (patch.account) {
        if (
          patch.account.uid !== id ||
          patch.account.username !== username ||
          patch.account.email !== user.account.email
        )
          throw new Error('Your username and email cannot be changed here.')
        patch.account = {
          ...user.account,
          name: text(patch.account.name, 100, true),
          shared: !!patch.account.shared,
          notifications: !!patch.account.notifications,
        }
      }
      const modified = []
      for (const [index, mode] of modes.entries()) {
        const value = { ...snapshots[index].data() }
        for (const field of ['drafts', 'published']) {
          const selected = data.profileModes?.[field] || modes
          if (!change[field] || !selected.includes(mode)) continue
          const key = field === 'drafts' ? 'draft' : 'published'
          value[key] = change[field][mode]
          if (field === 'drafts') drafts[mode] = value[key]
          else published[mode] = value[key]
        }
        if (JSON.stringify(value) !== JSON.stringify(snapshots[index].data()))
          modified.push([profileRefs[index], mode, value])
      }
      const active = patch.active || user.active
      if (!modes.includes(active) || (patch.active && !published[active]))
        throw new Error('Publish this mode before activating it.')
      if (Object.keys(patch).length) transaction.update(own, patch)
      for (const [ref, mode, value] of modified) {
        transaction.set(ref, value)
        if (
          !change.published ||
          (data.profileModes?.published && !data.profileModes.published.includes(mode))
        )
          continue
        const publicRef = doc(db, 'publicProfiles', username, 'modes', mode)
        if (!value.published) {
          transaction.delete(publicRef)
          continue
        }
        const projection = publicProfile(value.published)
        for (const assetId of new Set(imageIds(projection)))
          transaction.update(doc(db, 'images', assetId), { public: true })
        transaction.set(publicRef, { uid: id, profile: projection, updatedAt: serverTimestamp() })
      }
      if (change.published || patch.active) {
        const current = published[active]
        transaction.set(doc(db, 'publicProfiles', username), {
          uid: id,
          username,
          active,
          contactRequestsAllowed:
            !!current &&
            (!!current.contactBack ||
              Object.values(current.privacy || {}).includes('Request access')),
          updatedAt: serverTimestamp(),
        })
      }
      return { ...patch, drafts, published }
    })
  }
  if (action === 'generateCard') {
    await admin()
    const id = 'TAP-' + crypto.randomUUID().replaceAll('-', '').toUpperCase()
    const code = [...crypto.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    const card = {
      id,
      name: text(data.name || 'tap.io card', 100, true),
      tone: ['chalk', 'onyx', 'cobalt'].includes(data.tone) ? data.tone : 'chalk',
      status: 'Unclaimed',
      owner: '',
      ownerUid: '',
      activated: '',
    }
    const hash = await hashText(code),
      batch = writeBatch(db)
    batch.set(doc(db, 'cards', id), card)
    batch.set(doc(db, 'cardSecrets', id), { hash })
    await batch.commit()
    return { ...card, activationCode: code }
  }
  if (action === 'claimCard') {
    const user = await userRecord(),
      ref = doc(db, 'cards', text(data.id, 80, true)),
      claimHash = await hashText(text(data.code, 100, true).toUpperCase())
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref),
        card = snapshot.data()
      if (card?.ownerUid === user.id) return card
      if (!card || card.status !== 'Unclaimed') throw new Error('This card is unavailable.')
      const result = {
        ...card,
        ownerUid: user.id,
        owner: user.account.username,
        status: 'Claimed',
        activated: timestamp().slice(0, 10),
        claimHash,
      }
      transaction.set(ref, result)
      return result
    })
  }
  if (action === 'cardStatus') {
    userId()
    const ref = doc(db, 'cards', text(data.id, 80, true))
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref)
      if (!snapshot.exists()) throw new Error('Card not found.')
      const patch =
        data.name !== undefined ? { name: text(data.name, 100, true) } : { status: data.status }
      if (patch.status && !['Claimed', 'Disabled'].includes(patch.status))
        throw new Error('Invalid card status.')
      transaction.update(ref, patch)
      return { ...snapshot.data(), ...patch }
    })
  }
  if (action === 'placeOrder') {
    const user = await userRecord(),
      requestId = text(data.requestId, 80, true)
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(requestId)) throw new Error('Invalid order reference.')
    if (!Array.isArray(data.items) || !data.items.length || data.items.length > 8)
      throw new Error('Choose up to eight card designs per order.')
    const productIds = [...new Set(data.items.map((item) => text(item.productId, 100, true)))]
    if (productIds.length > 8)
      throw new Error('Please split this order into groups of up to eight card types.')
    const shipping = {
      name: text(data.shippingName, 100, true),
      address: text(data.address, 1000, true),
      phone: text(data.phone, 25, true),
    }
    if (!/^\+?[\d ()-]{7,25}$/.test(shipping.phone)) throw new Error('Enter a valid phone number.')
    const ref = doc(db, 'orders', 'TAP-' + requestId)
    return runTransaction(db, async (transaction) => {
      const existing = await transaction.get(ref)
      if (existing.exists()) return existing.data()
      const products = new Map()
      for (const productId of productIds)
        products.set(productId, (await transaction.get(doc(db, 'products', productId))).data())
      const priced = priceOrder(data.items, products)
      const order = {
        id: ref.id,
        ownerUid: user.id,
        customerId: user.account.username,
        customer: shipping.name,
        shippingDetails: shipping,
        ...clean(priced),
        payment: 'Pending',
        shipping: 'Pending',
        date: timestamp().slice(0, 10),
      }
      transaction.set(ref, { ...order, createdAt: serverTimestamp() })
      return { ...order, createdAt: timestamp() }
    })
  }
  if (action === 'orderStatus') {
    userId()
    const ref = doc(db, 'orders', text(data.id, 100, true))
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref),
        order = snapshot.data()
      if (!order) throw new Error('Order unavailable.')
      const { key, value } = data
      if (key === 'paymentProof') {
        if (order.payment === 'Paid') throw new Error('This payment is already verified.')
        if (value && !value.startsWith(imagePrefix))
          throw new Error('Upload your receipt image first.')
        transaction.update(ref, { paymentProof: value || '', payment: 'Pending' })
        return { ...order, paymentProof: value || '', payment: 'Pending' }
      }
      if (!['payment', 'shipping'].includes(key)) throw new Error('Invalid order update.')
      if (key === 'payment') {
        if (
          !order.paymentProof ||
          order.payment === 'Paid' ||
          !['Paid', 'Rejected'].includes(value)
        )
          throw new Error('Review an unverified payment proof first.')
        if (value === 'Paid') {
          const quantities = new Map()
          for (const item of order.items)
            quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity)
          const inventory = []
          for (const [id, quantity] of quantities) {
            const productRef = doc(db, 'products', id),
              product = (await transaction.get(productRef)).data()
            if (product?.stock !== undefined) {
              if (product.stock < quantity)
                throw new Error(
                  'Insufficient stock. Update inventory before verifying this payment.',
                )
              inventory.push([productRef, product.stock - quantity])
            }
          }
          for (const [productRef, stock] of inventory) transaction.update(productRef, { stock })
        }
      } else if (
        order.payment !== 'Paid' ||
        !['Pending', 'Packing', 'Shipped', 'Delivered'].includes(value)
      )
        throw new Error('Verify payment before processing shipment.')
      transaction.update(ref, { [key]: value })
      return { ...order, [key]: value }
    })
  }
  if (action === 'saveProduct') {
    await admin()
    const input = data.product,
      product = {
        id: input.id || crypto.randomUUID(),
        name: text(input.name, 100, true),
        description: text(input.description || '', 2000),
        colors: text(input.colors || '', 100),
        tone: input.tone,
        price: input.price,
        available: !!input.available,
      }
    if (
      !Number.isFinite(product.price) ||
      product.price < 0 ||
      !['chalk', 'onyx', 'cobalt'].includes(product.tone)
    )
      throw new Error('Choose a valid finish and price.')
    if (input.stock !== undefined) {
      if (!Number.isSafeInteger(input.stock) || input.stock < 0)
        throw new Error('Stock must be a nonnegative whole number.')
      product.stock = input.stock
    }
    await setDoc(doc(db, 'products', product.id), product)
    return product
  }
  if (action === 'initializeCatalog') {
    await admin()
    const catalog = [
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
    await runTransaction(db, async (transaction) => {
      const existing = await Promise.all(
        catalog.map((product) => transaction.get(doc(db, 'products', product.id))),
      )
      catalog.forEach((product, index) => {
        if (!existing[index].exists()) transaction.set(doc(db, 'products', product.id), product)
      })
    })
    return { saved: true }
  }
  if (action === 'paymentSettings') {
    await admin()
    const paymentDetails = { number: text(data.number || '', 30), qr: text(data.qr || '', 500) }
    const batch = writeBatch(db)
    for (const id of imageIds(paymentDetails.qr))
      batch.update(doc(db, 'images', id), { public: true })
    batch.set(doc(db, 'settings', 'store'), { paymentDetails })
    await batch.commit()
    return paymentDetails
  }
  if (action === 'sendMessage') {
    const user = await userRecord(),
      isAdmin = (await getDoc(doc(db, 'admins', user.id))).data()?.enabled === true
    const ownerUid = isAdmin ? text(data.ownerUid, 128, true) : user.id
    const message = {
      id: text(data.id, 100, true),
      ownerUid,
      sender: isAdmin ? 'admin' : 'customer',
      authorUid: user.id,
      text: text(data.text || '', 2000),
      image: text(data.image || '', 500),
    }
    if (!message.text && !message.image) throw new Error('Enter a message or attach an image.')
    const ref = doc(db, 'messages', user.id + '-' + message.id)
    await runTransaction(db, async (transaction) => {
      if (!(await transaction.get(ref)).exists())
        transaction.set(ref, { ...message, createdAt: serverTimestamp() })
    })
    return { ...message, createdAt: timestamp() }
  }
  if (action === 'requestTransfer') {
    const user = await userRecord(),
      id = text(data.id, 80, true)
    await setDoc(doc(db, 'transferRequests', id), {
      cardId: id,
      ownerUid: user.id,
      createdAt: serverTimestamp(),
      status: 'Pending',
    })
    return { sent: true }
  }
  if (action === 'contact') {
    const username = text(data.username, 24, true),
      target = (await getDoc(doc(db, 'publicProfiles', username))).data()
    if (!target?.contactRequestsAllowed) throw new Error('Contact requests are unavailable.')
    const request = {
      name: text(data.name, 100, true),
      email: text(data.email, 254, true),
      ownerUid: target.uid,
      username,
      request: text(data.request || 'Share contact', 100),
      date: timestamp().slice(0, 10),
      createdAt: serverTimestamp(),
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) throw new Error('Enter a valid email.')
    await setDoc(doc(collection(db, 'contactRequests')), request)
    return { sent: true }
  }
  if (action === 'track') {
    if (!['taps', 'links', 'contacts'].includes(data.event)) throw new Error('Invalid activity.')
    const username = text(data.username, 24, true),
      target = (await getDoc(doc(db, 'publicProfiles', username))).data()
    if (!target) return { recorded: false }
    const day = timestamp().slice(0, 10)
    let visitor = sessionStorage.getItem('tapio.v1.visitor')
    if (!visitor) {
      visitor = crypto.randomUUID()
      sessionStorage.setItem('tapio.v1.visitor', visitor)
    }
    const id = await hashText(visitor + username + day + data.event)
    await setDoc(doc(db, 'analytics', target.uid, 'events', id), {
      ownerUid: target.uid,
      username,
      event: data.event,
      day,
      createdAt: serverTimestamp(),
    })
    return { recorded: true }
  }
  if (action === 'closeAccount') {
    const user = await userRecord()
    if ((await getDoc(doc(db, 'admins', user.id))).data()?.enabled)
      throw new Error(
        'Remove administrator access in Firebase Console before closing this account.',
      )
    const [cards, images] = await Promise.all(
      ['cards', 'images'].map((name) =>
        getDocs(query(collection(db, name), where('ownerUid', '==', user.id))),
      ),
    )
    const batch = writeBatch(db)
    batch.update(doc(db, 'users', user.id), { closed: true })
    batch.delete(doc(db, 'publicProfiles', user.account.username))
    for (const mode of modes)
      batch.delete(doc(db, 'publicProfiles', user.account.username, 'modes', mode))
    cards.forEach((card) => batch.update(card.ref, { status: 'Disabled' }))
    images.forEach((image) => batch.update(image.ref, { public: false }))
    await batch.commit()
    return { closed: true }
  }
  throw new Error('Unknown operation.')
}
