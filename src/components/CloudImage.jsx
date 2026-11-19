import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { imagePrefix } from '../lib/firestore-actions'
import { useStore } from '../store'
export function useImageUrl(src) {
  const { state } = useStore()
  const [resolved, setResolved] = useState(null)
  const isCloud = typeof src === 'string' && src.startsWith(imagePrefix)
  useEffect(() => {
    if (!isCloud) return
    return onSnapshot(
      doc(db, 'images', src.slice(imagePrefix.length)),
      (snapshot) => setResolved({ src, value: snapshot.data()?.data || '' }),
      () => setResolved({ src, value: '' }),
    )
  }, [src, isCloud, state.account.uid, state.session])
  return isCloud ? (resolved?.src === src ? resolved.value : '') : src
}
export function CloudImage({ src, ...props }) {
  const url = useImageUrl(src)
  return url ? <img {...props} src={url} /> : null
}
