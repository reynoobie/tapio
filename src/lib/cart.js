export const cartItems=state=>Object.entries(state.cart).flatMap(([key,quantity])=>{
  const product=state.products.find(item=>item.id===(state.cartDesigns?.[key]?.productId||key))
  return product&&quantity>0?[{key,...product,quantity,design:state.cartDesigns?.[key]}]:[]
})
