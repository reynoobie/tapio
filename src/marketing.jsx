import {useEffect,useState} from 'react'
import {Link,useLocation,useNavigate} from 'react-router-dom'
import {ArrowRight,ArrowUpRight,ShoppingBag,Menu,Nfc,Layers3,ScanLine,UserRound,LogOut,KeyRound,ClipboardPenLine,Smartphone} from 'lucide-react'
import {Button,Dialog,Empty,Field,Logo,NavItems} from './ui'
import {money} from './data'
import {useStore} from './store'
import {cartItems} from './lib/cart'
import {isPurchaseReturn} from './lib/purchase'
import {authService} from './services/firebase'
import {ThemeToggle} from './site-theme'
import CardShowcase from './components/CardShowcase'
import NfcCard from './components/NfcCard'
import {BRAND} from './components/brand'
import {RotateCw} from 'lucide-react'
import ShopCard from './components/ShopCard'

const navigation=[['Home','/'],['Shop','/shop'],['How It Works','/how-it-works'],['Try Builder','/try-builder']]
const faq=[
 ['Which phones can open a tap.io card?','Tap the card on an NFC-compatible smartphone. You can also share the profile by copying its link.'],
 ['Can I change my profile after I receive the card?','Yes. Publish your changes or switch your active mode in your dashboard. Your card keeps the same URL.'],
 ['Do I need an account to try the builder?','You can edit and preview both modes as a guest. An account is required to publish a profile.'],
 ['Do visitors need an app?','A compatible phone opens the card link in its browser.'],
 ['What if my card is lost?','Open My NFC Cards and deactivate the lost card. You can reactivate it from the same screen.'],
 ['Who can see my contact details?','You choose which professional contact fields to make public.'],
 ['How do I pay for a card?','Place an order, pay using the GCash details on your order page, and upload your receipt. An admin verifies payment before preparing your card.'],
]
export function Header(){
  const [open,setOpen]=useState(false)
  const {state,update,setNotice}=useStore()
  const navigate=useNavigate()
  async function signOut(){
    update(await authService.signOut())
    setOpen(false)
    setNotice('Signed out.')
    navigate('/',{replace:true})
  }
  const account=state.session==='admin'?'/admin':state.session?'/app':'/login'
  return <header className="header"><div className="shell nav"><Logo/><nav aria-label="Main navigation" className="nav-links"><NavItems items={navigation}/></nav>
    <div className="nav-actions"><ThemeToggle/>{!state.session&&<Link className="login-link" to={account}>Login</Link>}<Button to={state.session?account:'/register'} className="get-started">{state.session?<><UserRound size={16} aria-hidden="true"/> My Account</>:<>Get Started <ArrowUpRight size={16}/></>}</Button>{state.session&&<Button kind="secondary" className="storefront-sign-out" onClick={signOut}><LogOut size={16} aria-hidden="true"/> Sign out</Button>}<button className="icon mobile-menu" aria-label="Open navigation" aria-expanded={open} onClick={()=>setOpen(true)}><Menu size={23}/></button></div>
    {open&&<Dialog title="tap.io menu" className="public-drawer" close={()=>setOpen(false)}><nav aria-label="Mobile navigation" onClick={()=>setOpen(false)}><NavItems items={[...navigation,[state.session?'My Account':'Login',account],['Check Phone Compatibility','/check-compatibility']]}/></nav>{state.session&&<Button kind="secondary" onClick={signOut}><LogOut size={16} aria-hidden="true"/> Sign out</Button>}</Dialog>}
  </div></header>
}
export function Footer(){return <footer><div className="shell footer-inner"><Logo/><div><Link to="/shop">Shop</Link><Link to="/try-builder">Try Builder</Link><Link to="/admin">Admin</Link></div><small>tap.io</small></div></footer>}
export function Home(){
  const [mode,setMode]=useState('Personal')
  const [heroFlipped,setHeroFlipped]=useState(false)
  return <main>
    <section className="shell hero"><div className="hero-copy"><div className="eyebrow"><span/> NFC DIGITAL IDENTITY</div><h1>One Tap.<br/><em>Endless<br className="desktop-break"/> <span>Possibilities.</span></em></h1><p>Your links, contacts, and work. All in one place, shared with a tap.</p><div className="actions"><Button to="/shop">Browse NFC cards <ArrowRight size={18}/></Button><Button to="/try-builder" kind="secondary">Try Profile Builder <ArrowUpRight size={17}/></Button></div></div>
    <div className="hero-visual hero-interactive"><div className="hero-display"><div className="hero-profile-phone"><div className="hero-phone-bar"/><div className="hero-phone-cover"/><div className="hero-phone-avatar">AR</div><strong>Alex Rivera</strong><small>{mode==='Professional'?'Product designer · Manila':'Photography · Manila'}</small><div className="hero-phone-links">{(mode==='Professional'?['Portfolio','Save contact']:['Instagram','My playlist']).map(label=><span key={label}>{label}<ArrowUpRight size={13}/></span>)}</div><div className="hero-phone-footer">Made with {BRAND}</div></div><div className="hero-card-placement"><NfcCard variant="black" name="Alex Rivera" title={mode==='Professional'?'Product designer':'Creator'} flipped={heroFlipped} onFlip={()=>setHeroFlipped(!heroFlipped)}/><button type="button" className="hero-flip-button" onClick={()=>setHeroFlipped(!heroFlipped)} aria-label="Flip example card" aria-pressed={heroFlipped}>Flip card</button></div></div><div className="hero-profile-switch"><span>Preview a profile</span><div aria-label="Sample profile mode">{['Personal','Professional'].map(value=><button key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{value}</button>)}</div></div></div></section>
    <section className="shell feature-strip"><div><Nfc/><span><strong>Tap to share</strong><small>Open your profile with an NFC card.</small></span></div><div><Layers3/><span><strong>Two profile modes</strong><small>Switch between personal and professional.</small></span></div><div><ScanLine/><span><strong>Edit anytime</strong><small>Keep the same card and update your links.</small></span></div></section>
    <section className="shell section"><SetupGuide/></section>
    <section className="shell section modes-section"><div><h2>One card, two profiles.</h2><p>Keep your social links in Personal Mode and your work, portfolio, and contact details in Professional Mode. Change which profile opens from your dashboard.</p><Button to="/try-builder">Try the live builder <ArrowRight size={17}/></Button></div><div className="mode-cards"><article><strong>Personal</strong><span>Social links · Photos · Music</span></article><article><strong>Professional</strong><span>Portfolio · Services · Contact</span></article></div></section>
    <CardShowcase/>
    <section className="shell compat-intro"><div><h2>Will it work with my phone?</h2><p>Check whether your phone can open an NFC card. You can also share your QR code.</p></div><Button to="/check-compatibility" kind="secondary">Check My Phone</Button></section>
    <section id="faq" className="shell section faq"><h2>Questions about tap.io</h2><div>{faq.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
    <section className="shell bottom-cta"><h2>Make your profile yours.</h2><Button to="/try-builder" kind="white">Open the builder <ArrowUpRight size={17}/></Button></section>
  </main>
}
function ProductGrid({products,accountShop}){
  const {update,setNotice}=useStore()
  const shopPath=accountShop?'/app/shop':'/shop'
  const [flipped,setFlipped]=useState({})
  const flip=id=>setFlipped(current=>({...current,[id]:!current[id]}))
  return <div className="grid-three product-grid">{products.map(product=><article className="product panel" key={product.id}><div className={"product-visual custom-product-stage product-visual--"+product.tone}><ShopCard product={product} flipped={Boolean(flipped[product.id])} onFlip={()=>flip(product.id)}/><button type="button" className="card-flip" aria-label={'Flip '+product.name} aria-pressed={Boolean(flipped[product.id])} onClick={()=>flip(product.id)}><RotateCw size={18}/></button></div><div className="product-info"><h3><Link to={shopPath+'/'+product.id}>{product.name}</Link></h3><p>{product.description}</p><p className="muted">{product.colors} · Price</p><div className="product-actions"><strong>{money(product.price)}</strong>{!accountShop?<Button to={shopPath+'/'+product.id} kind="secondary">View card</Button>:(product.id==='custom'||product.tone==='cobalt')?<Button to={shopPath+'/'+product.id} kind="secondary">Customize</Button>:<Button disabled={!product.available||product.stock===0} kind="secondary" onClick={()=>{update(current=>({cart:{...current.cart,[product.id]:(current.cart[product.id]||0)+1}}));setNotice('Added to cart.')}}>Add to Cart</Button>}</div></div></article>)}</div>
}
export function Shop({accountShop=false}){
  const {state}=useStore()
  const count=cartItems(state).reduce((sum,item)=>sum+item.quantity,0)
  return <main className={accountShop?'account-shop':'shell section'}><div className="section-head"><div>{!accountShop&&<p className="eyebrow">THE COLLECTION</p>}<h1>{accountShop?'Buy NFC cards':'Shop tap.io cards.'}</h1><p>Choose a finish for your NFC digital profile card.</p></div>{accountShop&&<Button to="/app/cart" kind="secondary"><ShoppingBag size={17} aria-hidden="true"/> View cart ({count})</Button>}</div>{state.products.length?<ProductGrid products={state.products} accountShop={accountShop}/>:<Empty title="No cards available"><p>Please check back soon.</p></Empty>}</main>
}
const setupGuide=[
  {title:'Choose a card',icon:ShoppingBag,body:'Pick a finish and place an order. A physical card comes with an activation code.',action:'Browse cards',to:'/shop'},
  {title:'Claim your card',icon:KeyRound,body:'Tap the card with an NFC-compatible phone. Sign in, then enter the included activation code to link it to your account.',action:'My cards',to:'/app/cards'},
  {title:'Build and publish',icon:ClipboardPenLine,body:'Add your name, photo, and links in the builder. Publish your profile and select Personal or Professional as the active mode.',action:'Try the builder',to:'/try-builder'},
  {title:'Share with a tap',icon:Smartphone,body:'Hold your card near a compatible phone to open the active profile. You can also share the profile link or QR code.',action:'Check phone compatibility',to:'/check-compatibility'},
]

function SetupGuide({standalone=false}){
  const {state}=useStore()
  const Heading=standalone?'h1':'h2'
  return <>
    <div className="section-head"><div><Heading>How tap.io works</Heading><p>Four steps from choosing your NFC card to sharing your profile.</p></div></div>
    <ol className="setup-guide">{setupGuide.map(({title,icon:Icon,body,action,to},index)=><li className="panel setup-guide-step" key={title}>
      <div className="setup-guide-visual" aria-hidden="true"><span>{index+1}</span><Icon size={40} strokeWidth={1.6}/></div>
      <div className="setup-guide-copy"><h3>{title}</h3><p>{body}</p><Link to={to==='/shop'&&!state.session?'/register':to} className="setup-guide-link">{to==='/shop'&&!state.session?'Create an account':action} <ArrowRight size={15} aria-hidden="true"/></Link></div>
    </li>)}</ol>
    <p className="setup-guide-note"><strong>Try the profile builder.</strong> Explore a sample profile, then create an account to save and publish your own.</p>
  </>
}

export function How(){
  return <main className="shell section"><SetupGuide standalone/><section id="faq" className="section faq"><h2>Questions about tap.io</h2><div>{faq.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section></main>
}
export function Compatibility(){
  const [platform,setPlatform]=useState('iPhone')
  const [range,setRange]=useState('iPhone XS, XR or newer')
  const options=platform==='iPhone'?['iPhone XS, XR or newer','iPhone 7, 8 or X','Older iPhone']:['My model has NFC','I’m not sure','My model has no NFC']
  const answers={'iPhone XS, XR or newer':'Your iPhone can generally read a tap.io card when it is awake.','iPhone 7, 8 or X':'Your iPhone may need a tag reader. The QR code is the simplest way to open the profile.','Older iPhone':'Use the QR code or a direct profile link.','My model has NFC':'Turn on NFC in Settings, then hold the card near the back of the phone.','I’m not sure':'Search for NFC in your phone settings or check the model specifications.','My model has no NFC':'Use the QR code or a direct profile link.'}
  return <main className="shell section"><section className="panel auth"><h1>Check your phone</h1><Field label="Phone type" value={platform} options={['iPhone','Android']} onChange={value=>{setPlatform(value);setRange(value==='iPhone'?'iPhone XS, XR or newer':'I’m not sure')}}/><Field label="Model or NFC setting" value={range} options={options} onChange={setRange}/><p role="status">{answers[range]}</p><p>A phone camera can scan a profile QR code without NFC.</p><Button to="/shop">Browse Cards</Button></section></main>
}
export function Cart(){
  const {state,update}=useStore()
  const items=cartItems(state)
  const total=items.reduce((sum,p)=>sum+p.price*p.quantity,0)
  function quantity(key,delta){update(current=>{const cart={...current.cart};const cartDesigns={...current.cartDesigns};const value=(cart[key]||0)+delta;if(value>0)cart[key]=value;else{delete cart[key];delete cartDesigns[key]}return {cart,cartDesigns}})}
  return <main className="account-shop"><div className="section-head"><h1>Your cart</h1>{items.length>0&&<Button to="/app/shop" kind="secondary">Continue shopping</Button>}</div>{items.length?<div className="grid-two"><section className="panel">{items.map(p=><div className="list-row" key={p.key}><ShopCard product={p} design={p.design}/><div><strong>{p.name}</strong><p>{money(p.price)}{p.design?.name?' · '+p.design.name:''}</p></div><div className="quantity"><button aria-label={'Decrease '+p.name} onClick={()=>quantity(p.key,-1)}>−</button>{p.quantity}<button aria-label={'Increase '+p.name} onClick={()=>quantity(p.key,1)}>+</button><button onClick={()=>quantity(p.key,-Infinity)}>Remove</button></div></div>)}</section><aside className="panel"><h2>Order summary</h2><p>Total <strong>{money(total)}</strong></p><Button to="/app/checkout">Continue to checkout</Button></aside></div>:<Empty title="Your cart is empty"><Button to="/app/shop">Browse Cards</Button></Empty>}</main>
}
export function Auth({kind}){
  const {state,update,setNotice}=useStore()
  const [name,setName]=useState('')
  const [username,setUsername]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [submitted,setSubmitted]=useState(false)
  const navigate=useNavigate()
  const {search}=useLocation()
  const params=new URLSearchParams(search)
  const claim=params.get('claim')
  const register=kind==='Register'
  const returnTo=params.get('returnTo')
  const purchase=isPurchaseReturn(returnTo)
  const next=claim&&/^TAP[0-9A-Z-]+$/.test(claim)?'/c/'+claim:purchase?returnTo:params.has('import')?'/app/builder':register?'/app/onboarding':returnTo&&/^\/app(?:\/|$)/.test(returnTo)?returnTo:'/app'
  const forgot=kind==='Forgot Password'
  useEffect(()=>{
    if(submitted&&state.session)navigate(state.session==='admin'?'/admin':next,{replace:true})
  },[submitted,state.session,next,navigate])
  async function start(event){
    event.preventDefault()
    setBusy(true);setError('')
    try{
      if(forgot){await authService.resetPassword(email);setNotice('If this email has an account, a password reset email will arrive shortly.');return}
      let session
      if(register){
        if(!/^[a-z][a-z0-9-]{2,23}$/.test(username))throw new Error('Use 3–24 lowercase letters, numbers, or hyphens for your username.')
        if(password.length<8)throw new Error('Choose a password with at least 8 characters.')
        session=await authService.signUp({name:name.trim(),username,email},password)
        setNotice('Account created. Check your email to verify your address.')
      }else session=await authService.signIn({email},password)
      if(params.has('import')&&!await update({drafts:Object.fromEntries(Object.entries(state.demo).map(([mode,p])=>[mode,{...p,username:session.account.username}]))}))throw new Error('Your account is ready, but the trial design could not be imported. Please retry.')
      setSubmitted(true)
    }catch(error){setError(error.message)}finally{setBusy(false)}
  }
  return <main className="shell section"><section className="panel auth"><h1>{kind}</h1><p>{forgot?'Enter your email to reset your password.':register?'Create your tap.io account to build a profile and connect your card.':'Sign in to manage your profile, cards, and orders.'}</p><form onSubmit={start}>
    {register&&<><Field label="Display name" value={name} onChange={setName} required autoComplete="name"/><Field label="Username" value={username} onChange={value=>setUsername(value.toLowerCase())} required maxLength={24} autoComplete="username"/><small>Your username becomes your permanent profile address.</small></>}
    <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email"/>
    {!forgot&&<Field label="Password" type="password" value={password} onChange={setPassword} required autoComplete={register?'new-password':'current-password'}/>}
    {error&&<p className="error" role="alert">{error}</p>}
    <button className="button" type="submit" disabled={busy||submitted}>{busy?'Please wait…':forgot?'Send reset email':register?'Create account':'Sign in'}</button>
  </form><div className="actions"><Link to={(register||forgot?'/login':'/register')+search}>{register||forgot?'Sign in':'Create account'}</Link>{!forgot&&<Link to="/forgot-password">Forgot password</Link>}</div></section></main>
}
