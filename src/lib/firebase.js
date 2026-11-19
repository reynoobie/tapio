import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { runAction, hashText, imagePrefix, MAX_IMAGE_CHARACTERS } from './firestore-actions'

const app = initializeApp({
  apiKey: 'AIzaSyCGOFB57WyGDoyL4-Bdgi60bpmRUJE61iE',
  authDomain: 'tap-io-517cd.firebaseapp.com',
  projectId: 'tap-io-517cd',
  messagingSenderId: '545662558446',
  appId: '1:545662558446:web:eb3d1fe287d8ccb58553ff',
})
export const auth = getAuth(app)
export const db = getFirestore(app)
if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099')
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
export async function call(action, data = {}) {
  try {
    return await runAction(db, auth, action, data)
  } catch (error) {
    throw new Error(
      error.message?.replace(/^Firebase:\s*/, '') || 'Could not connect. Please try again.',
    )
  }
}
const imageUploads = new Map()
async function uploadImage(value) {
  if (!auth.currentUser) throw new Error('Sign in before uploading images.')
  const uid = auth.currentUser.uid
  const key = uid + value
  if (imageUploads.has(key)) return imageUploads.get(key)
  const promise = (async () => {
    if (value.length > MAX_IMAGE_CHARACTERS) throw new Error('This image is too large. Choose a smaller image.')
    const id = uid + '_' + await hashText(value)
    if ((await getDoc(doc(db, 'images', id))).exists()) return imagePrefix + id
    await setDoc(doc(db, 'images', id), {
      ownerUid: uid, data: value, public: false, createdAt: serverTimestamp(),
    })
    return imagePrefix + id
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
