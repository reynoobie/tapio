import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser,
} from 'firebase/auth'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { auth, db, call, uploadImages } from '../lib/firebase'

export const authService = {
  async signUp(account, password) {
    const result = await createUserWithEmailAndPassword(auth, account.email.trim(), password)
    try {
      const user = await call('register', { name: account.name, username: account.username })
      await sendEmailVerification(result.user).catch(() => {})
      return { session: 'customer', account: user.account }
    } catch (error) {
      await deleteUser(result.user).catch(() => {})
      await signOut(auth).catch(() => {})
      throw error
    }
  },
  async signIn(account, password) {
    const result = await signInWithEmailAndPassword(auth, account.email.trim(), password)
    const [user, admin] = await Promise.all([
      getDoc(doc(db, 'users', result.user.uid)),
      getDoc(doc(db, 'admins', result.user.uid)),
    ])
    if (!user.exists()) {
      await signOut(auth)
      throw new Error('Account setup is incomplete. Contact support.')
    }
    if (user.data().closed) {
      await signOut(auth)
      throw new Error('This account is closed.')
    }
    return {
      session: admin.data()?.enabled === true ? 'admin' : 'customer',
      account: user.data().account,
    }
  },
  async signOut() {
    await signOut(auth)
    return { session: null }
  },
  async resetPassword(email) {
    await sendPasswordResetEmail(auth, email.trim())
    return { sent: true }
  },
  async verifyEmail() {
    await sendEmailVerification(auth.currentUser)
  },
}
export const profileService = {
  async publish(profile) {
    return uploadImages(profile)
  },
}
export const cardService = {
  async claim(card, code) {
    return call('claimCard', { id: card.id, code: code.trim() })
  },
  async setStatus(card, status) {
    return call('cardStatus', { id: card.id, status })
  },
  async generate(name, tone) {
    return call('generateCard', { name, tone })
  },
  async transfer(id) {
    return call('requestTransfer', { id })
  },
}
export const orderService = {
  async place(order) {
    return call('placeOrder', { ...order, items: await uploadImages(order.items) })
  },
  async setStatus(order, key, value) {
    return call('orderStatus', { id: order.id, key, value })
  },
}
export const adminService = {
  async saveProduct(product) {
    return call('saveProduct', { product: await uploadImages(product) })
  },
  async initializeCatalog() {
    return call('initializeCatalog')
  },
}

export const analyticsService = {
  async getSample() {
    if (!auth.currentUser) return []
    const snapshot = await getDocs(collection(db, 'analytics', auth.currentUser.uid, 'events'))
    const days = new Map()
    for (const row of snapshot.docs) {
      const { day, event } = row.data()
      const value = days.get(day) || { day, taps: 0, links: 0, contacts: 0 }
      if (['taps', 'links', 'contacts'].includes(event)) value[event]++
      days.set(day, value)
    }
    return [...days.values()].sort((a,b)=>a.day.localeCompare(b.day)).slice(-7)
  },
}
