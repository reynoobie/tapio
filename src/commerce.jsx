import {useRef,useState} from 'react'
import {Navigate,useNavigate,useParams} from 'react-router-dom'
import {Button,Empty,Field} from './ui'
import {money} from './data'
import {useStore} from './store'
import ImageField from './components/ImageField'
import {isPaid,paymentLabel} from './lib/payment'
import {orderService} from './services/firebase'
import ShopCard from './components/ShopCard'
import CustomCardEditor,{defaultCustomCard} from './components/CustomCardEditor'
import {RotateCw} from 'lucide-react'

import {cartItems} from './lib/cart'
import {purchaseLogin} from './lib/purchase'
export function ProductDetail({accountShop=false}){
  const {productId}=useParams()
  const accountProductPath='/app/shop/'+productId
  const shopPath=accountShop?'/app/shop':'/shop'
  const pageClass=accountShop?'account-shop':'shell section'
  const {state,update,setNotice}=useStore()
  const product=state.products.find(item=>item.id===productId)
  const [customCard,setCustomCard]=useState(defaultCustomCard)
  if(!product)return <main className={pageClass}><Empty title="Card not found"><Button to={shopPath}>Browse Cards</Button></Empty></main>
  const custom=product.id==='custom'||product.tone==='cobalt'
  const flip=()=>setCustomCard(card=>({...card,flipped:!card.flipped}))
  const missingName=custom&&!customCard.name.trim()
  function add(){
    if(missingName)return
    const key=custom?'custom-'+crypto.randomUUID():product.id
    const {flipped,...design}=customCard
    update(current=>({cart:{...current.cart,[key]:(current.cart[key]||0)+1},...(custom?{cartDesigns:{...current.cartDesigns,[key]:{productId:product.id,...design,name:design.name.trim()}}}:{})}))
    setNotice('Added to cart.')
  }
  return <main className={pageClass}>{accountShop&&<div className="section-head"><Button to="/app/shop" kind="secondary">Browse cards</Button><Button to="/app/cart" kind="secondary">View cart</Button></div>}<div className="grid-two product-detail"><div className={"product-visual product-visual--"+product.tone+' custom-product-stage'}><ShopCard product={product} design={custom?customCard:undefined} flipped={customCard.flipped} onFlip={flip}/><button type="button" className="card-flip" aria-label={'Flip '+product.name} aria-pressed={customCard.flipped} onClick={flip}><RotateCw size={18}/></button></div><article className="panel"><p className="eyebrow">tap.io NFC CARD</p><h1>{product.name}</h1><p>{product.description}</p><p><strong>{money(product.price)}</strong> · Price</p>{custom&&accountShop&&<CustomCardEditor card={customCard} onChange={setCustomCard}/>}<h2>What’s included</h2><ul><li>NFC card</li><li>Activation code</li></ul><div className="shop-buy">{accountShop&&missingName&&<p id="custom-name-hint">Enter a name before adding this card to your cart.</p>}{accountShop?<Button aria-describedby={accountShop&&missingName?'custom-name-hint':undefined} disabled={(accountShop&&missingName)||!product.available||product.stock===0} onClick={add}>Add to Cart</Button>:<Button to={state.session==='customer'?accountProductPath:purchaseLogin(accountProductPath)}>{state.session==='customer'?'Buy in My Account':'Sign in to buy'}</Button>}</div></article></div></main>
}
export function Checkout(){
  const {state,update,setNotice}=useStore()
  const navigate=useNavigate()
  const [info,setInfo]=useState({name:'',address:'',phone:''})
  const [busy,setBusy]=useState(false)
  const requestId=useRef(crypto.randomUUID())
  const items=cartItems(state)
  const total=items.reduce((sum,p)=>sum+p.price*p.quantity,0)
  if(!state.session)return <Navigate to={purchaseLogin('/app/checkout')} replace/>
  if(!items.length)return <main className="account-shop"><Empty title="Your cart is empty"><Button to="/app/shop">Browse Cards</Button></Empty></main>
  async function checkout(event){
    event.preventDefault()
    if(!Object.values(info).every(value=>value.trim())||!/^\+?[\d ()-]{7,18}$/.test(info.phone)){setNotice('Enter a name, address and valid phone number.');return}
    if(busy)return
    setBusy(true)
    try{
      const order=await orderService.place({items:items.map(({id,quantity,design})=>({productId:id,quantity,design:design?{...design}:undefined})),total,customer:state.account.name,customerId:state.account.username,shippingName:info.name.trim(),address:info.address.trim(),phone:info.phone.trim(),requestId:requestId.current})
      const saved=await update(current=>{
        const cart={...current.cart}
        const cartDesigns={...current.cartDesigns}
        for(const {key,quantity} of items){
          if(cart[key]>quantity)cart[key]-=quantity
          else{delete cart[key];delete cartDesigns[key]}
        }
        return {orders:[order,...current.orders],cart,cartDesigns}
      })
      if(!saved)setNotice('Order placed, but your cart could not be cleared. Your order is available in My Orders.')
      else setNotice('Order placed. Payment is pending.')
      navigate('/app/orders/'+order.id)
    }catch(error){setNotice(error.message);setBusy(false)}
  }
  return <main className="account-shop"><div className="section-head"><h1>Checkout</h1><Button to="/app/cart" kind="secondary">Back to cart</Button></div><p className="builder-banner">Review your delivery details. After placing your order, follow the GCash instructions and upload your payment receipt.</p><div className="grid-two"><form className="panel" onSubmit={checkout}>{[['name','Recipient name','text'],['address','Delivery address','textarea'],['phone','Phone number','tel']].map(([key,label,type])=><Field key={key} label={label} type={type} value={info[key]} required onChange={value=>setInfo({...info,[key]:value})}/>)}<button type="submit" className="button" disabled={busy}>{busy?'Placing Order…':'Place order'}</button></form><details open className="panel checkout-summary"><summary>Order summary · {money(total)}</summary>{items.map(p=><p key={p.key}>{p.name} × {p.quantity} · {money(p.price*p.quantity)}</p>)}<h2>Manual GCash payment</h2><p>After placing your order, upload your GCash receipt on the order page. Payment stays pending until an admin verifies it.</p></details></div></main>
}
export function OrderDetail({confirmation=false,admin=false}){
  const {orderId}=useParams()
  const {state,update,setNotice}=useStore()
  const order=state.orders.find(item=>item.id===orderId)
  const allowed=order&&(confirmation||admin||order.customerId===state.account.username||(!('customerId' in order)&&order.customer===state.account.name))
  if(!allowed)return <main className={confirmation?'shell section':''}><Empty title="Order unavailable"><Button to={confirmation?'/shop':'/app/orders'}>Go Back</Button></Empty></main>
  const paid=isPaid(order)
  const statuses=['Pending','Packing','Shipped','Delivered']
  const details=state.paymentDetails
  async function revise(change){
    return update(current=>({orders:current.orders.map(item=>item.id===orderId?change(item):item)}))
  }
  async function updateProof(paymentProof){
    if(await revise(item=>isPaid(item)?item:{...item,payment:'Pending',paymentProof}))setNotice(paymentProof?'Payment proof submitted for admin review.':'Payment proof removed.')
  }
  return <main className={confirmation?'shell section':''}>
    <section className="panel">
      <p className="eyebrow">ORDER</p>
      <h1>{confirmation?'Order placed':order.id}</h1>
      <p>{order.id} · {order.date} · {money(order.total)}</p>
      {order.items.map((item,i)=><p key={i}>{item.name} × {item.quantity}</p>)}
      <h2>Payment</h2>
      <p role="status">{paymentLabel(order)}</p>
      {!admin&&!paid&&<>
        <p>Pay using the GCash details below and upload your receipt for verification.</p>
        {details.number&&<p>GCash number: {details.number}</p>}
        {details.qr&&<img className="payment-qr" src={details.qr} alt="GCash QR"/>}
        {!details.number&&!details.qr&&<p>GCash details have not been configured.</p>}
        <ImageField label="Upload payment proof" value={order.paymentProof} onChange={updateProof}/>
      </>}
      {order.paymentProof&&(admin||paid)&&<a href={order.paymentProof} download={order.id+'-receipt.webp'} aria-label="Download submitted payment proof"><img className="payment-qr" src={order.paymentProof} alt="Submitted payment proof"/></a>}
      {admin&&!paid&&order.paymentProof&&<div className="actions">
        <Button onClick={()=>revise(item=>item.paymentProof?{...item,payment:'Paid'}:item)}>Mark as paid</Button>
        {paymentLabel(order)!=='Proof rejected'&&<Button kind="secondary" onClick={()=>revise(item=>isPaid(item)?item:{...item,payment:'Rejected'})}>Reject proof</Button>}
      </div>}
      {admin&&!paid&&!order.paymentProof&&<p>Waiting for the customer to upload proof.</p>}
      <ol className="order-timeline">{statuses.map((status,i)=><li className={i<=statuses.indexOf(order.shipping)?'reached':''} key={status}>{status}</li>)}</ol>
      {admin&&paid&&<Field label="Shipping status" value={order.shipping} options={statuses} onChange={shipping=>revise(item=>isPaid(item)?{...item,shipping}:item)}/>}
      <Button to={admin?'/admin/orders':state.session==='customer'?'/app/orders':'/shop'}>{admin||state.session==='customer'?'View Orders':'Back to Shop'}</Button>
    </section>
  </main>
}
