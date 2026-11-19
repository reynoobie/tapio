import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadString,
  getDownloadURL,
} from 'firebase/storage'

const app = initializeApp({
  apiKey: 'AIzaSyCGOFB57WyGDoyL4-Bdgi60bpmRUJE61iE',
  authDomain: 'tap-io-517cd.firebaseapp.com',
  projectId: 'tap-io-517cd',
  storageBucket: 'tap-io-517cd.firebasestorage.app',
  messagingSenderId: '545662558446',
  appId: '1:545662558446:web:eb3d1fe287d8ccb58553ff',
})
export const auth = getAuth(app)
export const db = getFirestore(app)
const functions = getFunctions(app, 'asia-southeast1')
const storage = getStorage(app)
if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099')
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}
export async function call(action, data = {}) {
  try {
    return (await httpsCallable(functions, 'tapio')({ action, ...data })).data
  } catch (error) {
    throw new Error(
      error.message?.replace(/^Firebase:\s*/, '') || 'Could not connect. Please try again.',
    )
  }
}
const imageUploads = new Map()
async function uploadImage(value) {
  if (!auth.currentUser) throw new Error('Sign in before uploading images.')
  const key = auth.currentUser.uid + value
  if (imageUploads.has(key)) return imageUploads.get(key)
  const promise = (async () => {
    const target = ref(storage, `private/${auth.currentUser.uid}/${crypto.randomUUID()}.webp`)
    await uploadString(target, value, 'data_url')
    return getDownloadURL(target)
  })()
  imageUploads.set(key, promise)
  try {
    return await promise
  } catch (error) {
    imageUploads.delete(key)
    throw error
  }
}
export async function uploadImages(value) {
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    return uploadImage(value)
  }
  if (Array.isArray(value)) return Promise.all(value.map(uploadImages))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value)
          .filter(([, item]) => item !== undefined)
          .map(async ([key, item]) => [key, await uploadImages(item)]),
      ),
    )
  return value
}
