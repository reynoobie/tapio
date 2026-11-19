import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { initial } from './data'
import { auth, db, call, uploadImages } from './lib/firebase'

const State = createContext()
const privateFields = [
  'account',
  'active',
  'drafts',
  'published',
  'cart',
  'cartDesigns',
  'checklistHidden',
  'messageRead',
]
function guestDesign() {
  try {
    const saved = JSON.parse(localStorage.getItem('tapio.v1.guest'))
    if (
      ['Personal', 'Professional'].every(
        (mode) =>
          Array.isArray(saved?.[mode]?.sections) &&
          Array.isArray(saved?.[mode]?.links) &&
          Array.isArray(saved?.[mode]?.buttons),
      )
    )
      return saved
  } catch {}
  return structuredClone(initial.demo)
}
const blank = () => ({
  ...structuredClone(initial),
  demo: guestDesign(),
  authReady: false,
  syncError: '',
  saving: false,
  customers: [],
})
const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b)
export function Store({ children }) {
  const [state, setState] = useState(blank)
  const [notice, setNotice] = useState('')
  const current = useRef(state)
  const queue = useRef(Promise.resolve())
  const pending = useRef(0)
  const confirmed = useRef(null)
  const apply = useCallback((change) => {
    current.current = { ...current.current, ...change }
    setState(current.current)
  }, [])
  useEffect(() => {
    const publicStops = []
    const error = (error) =>
      apply({
        syncError:
          error.message || 'Firebase is unavailable. Check your connection and Firebase setup.',
      })
    const list = (source, field, stops) =>
      stops.push(
        onSnapshot(
          source,
          (snapshot) => {
            const values = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }))
            if (['messages', 'orders'].includes(field))
              values.sort(
                (a, b) =>
                  (a.createdAt || '').localeCompare(b.createdAt || '') *
                  (field === 'orders' ? -1 : 1),
              )
            apply({ [field]: values })
          },
          error,
        ),
      )
    list(collection(db, 'products'), 'products', publicStops)
    publicStops.push(
      onSnapshot(
        doc(db, 'settings', 'store'),
        (snapshot) =>
          apply({ paymentDetails: snapshot.data()?.paymentDetails || { number: '', qr: '' } }),
        error,
      ),
    )
    let userStops = []
    let generation = 0
    const stopAuth = onAuthStateChanged(
      auth,
      (user) => {
        const turn = ++generation
        userStops.forEach((stop) => stop())
        userStops = []
        pending.current = 0
        confirmed.current = null
        const fresh = blank()
        apply({
          ...fresh,
          products: current.current.products,
          paymentDetails: current.current.paymentDetails,
          demo: current.current.demo,
          authReady: !user,
        })
        if (!user) return
        let role = 'customer'
        let gotAccount = false
        const userError = (problem) => {
          error(problem)
          apply({ authReady: true })
        }
        userStops.push(
          onSnapshot(
            doc(db, 'users', user.uid),
            (snapshot) => {
              if (turn !== generation) return
              if (!snapshot.exists()) {
                apply({ authReady: true })
                return
              }
              const data = snapshot.data()
              if (data.closed) {
                apply({ authReady: true, session: null, syncError: 'This account is closed.' })
                return
              }
              confirmed.current = data
              if (!pending.current)
                apply({ ...data, session: role, authReady: true, syncError: '' })
              gotAccount = true
            },
            userError,
          ),
        )
        userStops.push(
          onSnapshot(
            doc(db, 'admins', user.uid),
            (snapshot) => {
              if (turn !== generation) return
              role = snapshot.data()?.enabled === true ? 'admin' : 'customer'
              if (gotAccount)
                apply({
                  session: role,
                  cards: [],
                  orders: [],
                  messages: [],
                  contactRequests: [],
                  customers: [],
                })
              userStops.slice(2).forEach((stop) => stop())
              userStops = userStops.slice(0, 2)
              const owned = (field) =>
                role === 'admin'
                  ? collection(db, field)
                  : query(collection(db, field), where('ownerUid', '==', user.uid))
              for (const field of ['cards', 'orders', 'messages', 'contactRequests'])
                list(owned(field), field, userStops)
              if (role === 'admin') list(collection(db, 'users'), 'customers', userStops)
            },
            error,
          ),
        )
      },
      error,
    )
    return () => {
      generation++
      stopAuth()
      publicStops.forEach((stop) => stop())
      userStops.forEach((stop) => stop())
    }
  }, [apply])

  const update = useCallback(
    (change) => {
      const before = current.current
      const patch = typeof change === 'function' ? change(before) : change
      if (!patch) return Promise.resolve(true)
      const { demo, ...remote } = patch
      if (demo) {
        try {
          localStorage.setItem('tapio.v1.guest', JSON.stringify(demo))
          apply({ demo })
        } catch {
          setNotice('This browser could not save your trial design.')
          return Promise.resolve(false)
        }
      }
      // Authentication state comes exclusively from Firebase's listener.
      delete remote.session
      if (!Object.keys(remote).length) return Promise.resolve(true)
      if (!auth.currentUser) {
        setNotice('Sign in to save changes.')
        return Promise.resolve(false)
      }
      const identity = auth.currentUser.uid
      const fields = Object.fromEntries(
        Object.entries(remote).filter(
          ([key, value]) => privateFields.includes(key) && changed(before[key], value),
        ),
      )
      const writes = []
      for (const field of ['cards', 'orders', 'products']) {
        if (!remote[field]) continue
        for (const item of remote[field]) {
          const old = before[field].find((row) => row.id === item.id)
          if (!old || !changed(old, item)) continue
          if (field === 'cards')
            writes.push({
              action: 'cardStatus',
              id: item.id,
              ...(item.name !== old.name ? { name: item.name } : { status: item.status }),
            })
          if (field === 'orders')
            for (const key of changed(old.paymentProof, item.paymentProof)
              ? ['paymentProof']
              : ['payment', 'shipping'])
              if (changed(old[key], item[key]))
                writes.push({ action: 'orderStatus', id: item.id, key, value: item[key] || '' })
          if (field === 'products') writes.push({ action: 'saveProduct', product: item })
        }
      }
      for (const message of remote.messages || [])
        if (!before.messages.some((old) => old.id === message.id))
          writes.push({ action: 'sendMessage', ...message })
      if (remote.paymentDetails && changed(before.paymentDetails, remote.paymentDetails))
        writes.push({ action: 'paymentSettings', ...remote.paymentDetails })
      if (!Object.keys(fields).length && !writes.length) return Promise.resolve(true)
      apply({ ...fields, saving: true })
      pending.current++
      const save = async () => {
        if (auth.currentUser?.uid !== identity) return false
        try {
          if (Object.keys(fields).length) {
            const saved = await call('saveWorkspace', { change: await uploadImages(fields) })
            confirmed.current = { ...confirmed.current, ...saved }
          }
          for (const { action, ...data } of writes) await call(action, await uploadImages(data))
          return true
        } catch (error) {
          setNotice(error.message)
          apply({ syncError: 'Changes could not be saved. ' + error.message })
          return false
        } finally {
          if (auth.currentUser?.uid === identity) {
            pending.current--
            if (!pending.current) apply({ ...confirmed.current, saving: false })
          }
        }
      }
      queue.current = queue.current.then(save, save)
      return queue.current
    },
    [apply],
  )
  return <State.Provider value={{ state, update, notice, setNotice }}>{children}</State.Provider>
}
export const useStore = () => useContext(State)
