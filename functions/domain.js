export const modes = ['Personal', 'Professional']
export function validUsername(value) {
  return (
    typeof value === 'string' &&
    /^[a-z][a-z0-9-]{2,23}$/.test(value) &&
    !['admin', 'login', 'support', 'tapio'].includes(value)
  )
}
export function publicProfile(profile) {
  const result = structuredClone(profile)
  for (const field of ['email', 'phone', 'website']) {
    if (result.privacy?.[field] && result.privacy[field] !== 'Public') result[field] = ''
  }
  result.sections = (result.sections || []).filter((section) => !section.hidden)
  return result
}
export function priceOrder(lines, products) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 40)
    throw new Error('Choose between 1 and 40 card designs per order.')
  const quantities = new Map()
  const items = lines.map((line) => {
    const product = products.get(line.productId)
    if (
      !product?.available ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 100
    )
      throw new Error('A card is unavailable or has an invalid quantity.')
    if (!Number.isFinite(product.price) || product.price < 0)
      throw new Error('A card price is unavailable.')
    const quantity = (quantities.get(line.productId) || 0) + line.quantity
    quantities.set(line.productId, quantity)
    if (product.stock !== undefined && product.stock < quantity)
      throw new Error(product.name + ' has insufficient stock.')
    if (line.design) {
      if (typeof line.design.name !== 'string' || line.design.name.length > 26)
        throw new Error('Invalid custom card name.')
      if (
        line.design.title !== undefined &&
        (typeof line.design.title !== 'string' || line.design.title.length > 30)
      )
        throw new Error('Invalid custom card title.')
      if (JSON.stringify(line.design).length > 20000)
        throw new Error('This custom card design is too large.')
    }
    if ((line.productId === 'custom' || product.tone === 'cobalt') && !line.design?.name?.trim())
      throw new Error('Enter a name for your custom card.')
    return {
      productId: line.productId,
      name: product.name,
      price: product.price,
      quantity: line.quantity,
      ...(line.design ? { design: line.design } : {}),
    }
  })
  return {
    items,
    total: Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100,
  }
}
