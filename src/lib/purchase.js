export function purchaseLogin(to){
  return '/login?returnTo='+encodeURIComponent(to)
}

export function isPurchaseReturn(to){
  return typeof to==='string'&&/^\/(?:app\/)?(?:shop(?:\/[a-z0-9-]+)?|cart|checkout)$/i.test(to)
}
