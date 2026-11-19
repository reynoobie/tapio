import {CloudImage} from './components/CloudImage'
import {useEffect,useRef,useState} from 'react'
import {Link,NavLink,Navigate,Outlet,useLocation,useNavigate,useParams,useSearchParams} from 'react-router-dom'
import {ArrowUpRight,ChevronDown,Menu,House,Layers,Nfc,Ellipsis,Package,Settings as SettingsIcon,Users,CreditCard,ShoppingBag,Check,Circle,MessageCircle,Copy,Minus,Maximize2,X,ImagePlus,Send} from 'lucide-react'
import {money,modes,profile,safeLink} from './data'
import {useStore} from './store'
import {BackNavigation,Button,Dialog,Empty,Field,Logo,NavItems} from './ui'
import NfcCard from './components/NfcCard'
import {ProfileView} from './public-profile'
import {ShareProfile} from './share'
import {adminService,authService,cardService,orderService} from './services/firebase'
import {ThemeToggle,useSiteTheme} from './site-theme'
import {auth,db,call} from './lib/firebase'
import {doc,onSnapshot} from 'firebase/firestore'
import {publicUrl} from './lib/urls'
import {compressImage} from './lib/images'
import {isPaid,paymentLabel} from './lib/payment'
import './messaging.css'

const customerLinks=[['Home','/app'],['My Profiles','/app/profiles'],['My NFC Cards','/app/cards'],['My Orders','/app/orders'],['Buy cards','/app/shop'],['Settings','/app/settings'],['Help','/app/messages']]
const adminLinks=[['Home','/admin'],['Customers','/admin/customers'],['Products','/admin/products'],['Orders','/admin/orders'],['NFC Cards','/admin/cards'],['Payments','/admin/payments'],['Settings','/admin/settings'],['Help','/admin/messages']]
const customerIcons=[House,Layers,Nfc,Package,ShoppingBag,SettingsIcon,MessageCircle]
const adminIcons=[House,Users,ShoppingBag,Package,Nfc,CreditCard,SettingsIcon,MessageCircle]
export function Workspace({admin=false}){
  const {state,update}=useStore()
  const [open,setOpen]=useState(false)
  const [more,setMore]=useState(false)
  const navigate=useNavigate()
  const location=useLocation()
  const signingOut=useRef(false)
  const role=admin?'admin':'customer'
  if(!state.authReady)return <main className="shell section" role="status">Loading your account…</main>
  if(state.session!==role){
    if(signingOut.current)return null
    if(!admin)return <Navigate to={'/login?returnTo='+encodeURIComponent(location.pathname)} replace/>
    return <main className="shell section"><Empty title="Administrator access required"><p>Sign in using an account granted administrator access.</p><Button to="/login">Sign in</Button></Empty></main>
  }
  const links=admin?adminLinks:customerLinks
  const icons=admin?adminIcons:customerIcons
  async function signOut(){
    await authService.signOut()
    signingOut.current=true
    navigate('/',{replace:true})
  }
  function dashboardLink([label,to],index,short=false){
    const Icon=icons[index]
    const name=short?(admin?['Home','Customers','Products','Orders'][index]:['Home','Profiles','Cards','Orders'][index]):label
    return <NavLink key={to} to={to} end={index===0} aria-label={label} title={label}><Icon size={19}/><span>{name}</span></NavLink>
  }
  return <div className={'workspace '+(open?'rail-open':'')}>
    <aside className="workspace-sidebar">
      <Logo/>
      <nav aria-label={admin?'Admin dashboard':'Customer dashboard'}>
        {links.slice(0,-1).map((link,i)=>dashboardLink(link,i))}
        <div className="sidebar-help">{dashboardLink(links.at(-1),links.length-1)}</div>
      </nav>
      <button className="icon rail-expand" aria-label="Expand dashboard navigation" aria-expanded={open} onClick={()=>setOpen(!open)}><Menu size={19}/></button>
    </aside>
    <div className="workspace-content">
      <WorkspaceTopBar admin={admin} signOut={signOut}/>
      <BackNavigation workspace/><Outlet key={location.pathname}/>
    </div>
    <nav className="dash-tabs" aria-label="Dashboard tabs">{links.slice(0,4).map((link,i)=>dashboardLink(link,i,true))}<button aria-expanded={more} onClick={()=>setMore(true)}><Ellipsis size={20}/>More</button></nav>
    {more&&<Dialog title="Dashboard menu" close={()=>setMore(false)}>
      <nav className="drawer-links" onClick={()=>setMore(false)}><NavItems items={links}/></nav>
      <Button kind="secondary" onClick={signOut}>Sign Out</Button>
    </Dialog>}
  </div>
}
function WorkspaceTopBar({admin,signOut}){
  const {state,setNotice}=useStore()
  const {theme,toggleTheme}=useSiteTheme()
  const location=useLocation()
  const [menuLocation,setMenuLocation]=useState(null)
  const open=menuLocation===location
  const [phone,setPhone]=useState(()=>matchMedia('(max-width:767px)').matches)
  const trigger=useRef(null)
  const menu=useRef(null)
  const account=state.account
  const firstName=account.name?.trim().split(/\s+/)[0]||'Account'
  const path='/p/'+account.username
  const base=admin?'/admin':'/app'
  const count=admin?state.orders.filter(awaitsReview).length:0

  useEffect(()=>{
    const media=matchMedia('(max-width:767px)')
    const resize=event=>{setPhone(event.matches);setMenuLocation(null)}
    media.addEventListener('change',resize)
    return ()=>media.removeEventListener('change',resize)
  },[])

  function close(){
    setMenuLocation(null)
    requestAnimationFrame(()=>trigger.current?.focus())
  }

  useEffect(()=>{
    if(!open||phone)return
    const button=trigger.current
    const panel=menu.current
    panel.querySelector('[role="menuitem"]')?.focus()
    function outside(event){
      if(panel.contains(event.target)||button.contains(event.target))return
      setMenuLocation(null)
      requestAnimationFrame(()=>button.focus())
    }
    document.addEventListener('pointerdown',outside)
    return ()=>document.removeEventListener('pointerdown',outside)
  },[open,phone])

  function navigateMenu(event){
    if(event.key==='Escape'){event.preventDefault();close();return}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return
    event.preventDefault()
    const items=[...menu.current.querySelectorAll('[role="menuitem"]')]
    const index=items.indexOf(document.activeElement)
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length
    items[next]?.focus()
  }

  async function copy(){
    try{await navigator.clipboard.writeText(publicUrl(path));setNotice('Profile link copied.')}
    catch{setNotice('Could not copy the profile link.')}
  }

  const itemProps=phone?{}:{role:'menuitem',tabIndex:-1}
  const entries=<>
    <div className="account-menu-identity" role={phone?undefined:'presentation'}><strong>{account.name}</strong><span>{account.email}</span></div>
    <Link {...itemProps} to={base+'/settings'} onClick={close}>Settings</Link>
    <Link {...itemProps} to={base+'/messages'} onClick={close}>Help</Link>
    <button type="button" {...itemProps} onClick={toggleTheme}>Theme <span>{theme==='dark'?'Dark':'Light'}</span></button>
    <hr role={phone?undefined:'separator'}/>
    <button type="button" {...itemProps} className="account-signout" onClick={signOut}>Sign out</button>
  </>

  return <div className="workspace-mobile account-topbar">
    <div className="account-phone-logo"><Logo/></div>
    <div className="account-topbar-status">
      {admin?<><span className="account-mode-chip">Admin</span></>:<Link className="account-mode-chip" to="/app/profiles">{state.published[state.active]?'● ':''}{state.active} · {state.published[state.active]?'Live':'Draft'}</Link>}
    </div>
    <div className="account-topbar-actions">
      {admin?<Button className="attention-link" kind="secondary" to="/admin/orders?payment=pending-proof">Needs attention ({count})</Button>:<>
        <Button className="topbar-profile" kind="secondary" to={path} target="_blank" rel="noopener noreferrer" aria-label="View my profile" title="View my profile"><span>View my profile</span><ArrowUpRight size={17} aria-hidden="true"/></Button>
        <button className="icon topbar-copy" type="button" aria-label="Copy link" title="Copy link" onClick={copy}><Copy size={18} aria-hidden="true"/></button>
        <ThemeToggle/>
      </>}
      <button className="account-trigger" ref={trigger} type="button" aria-label={firstName+' account menu'} aria-haspopup={phone?'dialog':'menu'} aria-expanded={open} onClick={()=>open?close():setMenuLocation(location)} onKeyDown={event=>{if(!phone&&event.key==='ArrowDown'){event.preventDefault();if(open)menu.current?.querySelector('[role="menuitem"]')?.focus();else setMenuLocation(location)}}}>
        <span className="account-initial" aria-hidden="true">{firstName[0].toUpperCase()}</span><span className="account-name">{firstName}</span><ChevronDown size={15} aria-hidden="true"/>
      </button>
      {open&&(phone?<Dialog title="Account" className="account-sheet" close={close}><div className="account-menu-list">{entries}</div></Dialog>:<div ref={menu} className="account-popover account-menu-list" role="menu" aria-label="Account" onKeyDown={navigateMenu} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)&&event.relatedTarget!==trigger.current&&event.relatedTarget)setMenuLocation(null)}}>{entries}</div>)}
    </div>
  </div>
}

export function PageHead({title,description,children}){return <div className="section-head"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{children}</div>}
function Stats({items}){return <div className="stats">{items.map(([label,value])=><article key={label} className="panel"><span>{label}</span><strong>{value}</strong></article>)}</div>}

function ownedCardVariant(card){
  return ({chalk:'classic',onyx:'black',cobalt:'custom'})[card.tone]||(/matte|black/i.test(card.name)?'black':/custom/i.test(card.name)?'custom':'classic')
}

export function CustomerOverview(){
  const {state,update,setNotice}=useStore()
  const [share,setShare]=useState(false)
  const [switchTo,setSwitchTo]=useState(null)
  const [preview,setPreview]=useState(false)
  const draft=state.drafts[state.active]
  const published=state.published[state.active]
  const ownerCards=state.cards.filter(c=>c.owner===state.account.username)
  const path='/p/'+state.account.username
  const claimed=ownerCards.find(card=>card.status==='Claimed')
  const builder='/app/builder/'+state.active.toLowerCase()
  const checks=[
    ['Add a profile photo',!!draft.avatar,builder+'?tab=Profile'],
    ['Add three links',[...draft.links,...draft.buttons].filter(link=>safeLink(link.url)).length>=3,builder+'?tab=Links'],
    ['Claim your card',Boolean(claimed),'/app/cards'],
    ['Go live',!!published,builder+'#publish-profile'],
    ['Share your link',!!state.account.shared],
  ]
  const complete=checks.filter(([,done])=>done).length
  const firstName=state.account.name?.trim().split(/\s+/)[0]||'there'
  const recentOrders=state.orders.filter(order=>order.customerId===state.account.username||(!('customerId' in order)&&order.customer===state.account.name)).slice(0,2)
  const visitorPreview=published?<ProfileView profile={published} mode={state.active}/>:<p>Publish a profile to see it here.</p>
  async function copy(){try{await navigator.clipboard.writeText(publicUrl(path));update(current=>({account:{...current.account,shared:true}}));setNotice('Profile link copied.')}catch{setShare(true)}}
  return <main className="account-home">
  <div className="account-home-heading"><h1>Hi, {firstName}</h1><Button kind="secondary" className="visitor-preview-button" onClick={()=>setPreview(true)}>Preview</Button></div>
  <div className="account-home-layout">
  <div className="account-home-stack">
    <section className="panel active-panel">
      <h2>{claimed?claimed.name:'Active profile'}</h2>
      {claimed&&<div className="dashboard-card-art"><NfcCard qrValue={publicUrl('/c/'+claimed.id)} variant={ownedCardVariant(claimed)} name={published?.name||draft.name} title={state.active==='Professional'?(published||draft).title?.trim()||null:null}/></div>}
      {claimed&&<p>Tapping your card opens: <strong>{state.active}</strong></p>}
      <div className="mode-switch" role="group" aria-label="Active profile mode">{modes.map(mode=><Button key={mode} kind={mode===state.active?'':'secondary'} aria-pressed={mode===state.active} disabled={!state.published[mode]} onClick={()=>{if(mode!==state.active)setSwitchTo(mode)}}>{mode}{!state.published[mode]&&<small>Publish first</small>}</Button>)}</div>
      <p>{publicUrl(path).replace(/^https?:\/\//,'')}</p>
      <div className="actions"><Button to={builder}>Edit profile</Button><Button kind="secondary" to={path}>View profile</Button><Button kind="secondary" onClick={copy}>Copy link</Button><Button kind="secondary" onClick={()=>setShare(true)}>QR</Button></div>
    </section>
    {complete===checks.length?<p className="panel setup-complete"><Check size={18} aria-hidden="true"/> Setup complete</p>:!state.checklistHidden&&<section className="panel checklist">
      <div className="list-row"><h2>Get started</h2><Button kind="secondary" onClick={()=>update({checklistHidden:true})}>Dismiss</Button></div>
      <p>{complete} of {checks.length} steps complete</p>
      <progress aria-label="Profile setup completion" value={complete} max={checks.length}/>
      <ul>{checks.map(([label,done,to])=><li key={label}>{done?<Check size={17}/>:<Circle size={17}/>}
        {to?<Link to={to} className="checklist-link">{label}</Link>:<button type="button" className="checklist-link" onClick={()=>setShare(true)}>{label}</button>}
        {done&&<small>Done</small>}
      </li>)}</ul>
    </section>}
    <section className="panel account-list">
      <div className="list-row"><h2>My cards</h2><div className="actions"><Link to="/app/cards">Manage cards</Link><Link to="/app/shop">Buy cards</Link></div></div>
      {ownerCards.length?ownerCards.map(card=><div className="list-row" key={card.id}><span>{card.name}</span><span className="status">{card.status}</span></div>):<p>Claim a card to connect it to your profile.</p>}
    </section>
    <section className="panel account-list">
      <div className="list-row"><h2>Recent orders</h2><Link to="/app/orders">View all</Link></div>
      {recentOrders.length?recentOrders.map(order=><div className="list-row" key={order.id}><Link to={'/app/orders/'+order.id}>{order.id}</Link><span className="status">{order.shipping}</span></div>):<p>No orders yet.</p>}
    </section>
    <section className="panel account-list">
      <h2>Contact requests</h2>
      {state.contactRequests.length?state.contactRequests.map((request,index)=><div className="list-row" key={index}><span>{request.name}</span><span>{request.email}</span></div>):<p>No contact requests yet.</p>}
    </section>
  </div>
  <aside className="panel visitor-preview"><h2>What visitors see</h2>{visitorPreview}</aside>
  </div>
  {preview&&<Dialog title="What visitors see" close={()=>setPreview(false)}>{visitorPreview}</Dialog>}
  {switchTo&&<ModeSwitchDialog mode={switchTo} close={()=>setSwitchTo(null)}/>}
  {share&&<ShareProfile path={path} close={()=>setShare(false)}/>}</main>
}
export function Profiles(){
  const {state}=useStore()
  const [dialog,setDialog]=useState(null)
  return <main><PageHead title="My Profiles" description="Each mode has its own draft and published profile."/><div className="grid-two">{modes.map(mode=><section className="panel" key={mode}><div className="list-row"><h2>{mode}</h2>{state.active===mode&&<span className="status">Active</span>}</div><p>{state.published[mode]?'Published':'Unpublished. Publish this mode before switching to it.'}</p><div className="actions"><Button kind="secondary" onClick={()=>setDialog({mode,preview:true})}>Preview</Button><Button to={'/app/builder/'+mode.toLowerCase()} kind="secondary">Edit</Button><Button disabled={state.active===mode||!state.published[mode]} onClick={()=>setDialog({mode})}>Make Active</Button></div></section>)}</div>{dialog&&(dialog.preview?<Dialog title={dialog.mode+' preview'} close={()=>setDialog(null)}><ProfileView profile={state.published[dialog.mode]||state.drafts[dialog.mode]} mode={dialog.mode}/></Dialog>:<ModeSwitchDialog mode={dialog.mode} close={()=>setDialog(null)}/>)}</main>
}
function ModeSwitchDialog({mode,close}){
  const {state,update,setNotice}=useStore()
  return <Dialog title={'Switch to '+mode+' Mode?'} close={close}>
    <p>Your card will open this published profile using the same NFC URL.</p>
    <div className="profile-compare">
      <div><strong>Current · {state.active}</strong>{state.published[state.active]?<ProfileView profile={state.published[state.active]} mode={state.active}/>:<p>No profile live yet.</p>}</div>
      <div><strong>After · {mode}</strong>{state.published[mode]&&<ProfileView profile={state.published[mode]} mode={mode}/>}</div>
    </div>
    <div className="actions"><Button disabled={!state.published[mode]} onClick={async()=>{if(await update({active:mode})){close();setNotice('Active profile mode updated.')}}}>Switch Mode</Button><Button kind="secondary" onClick={close}>Cancel</Button></div>
  </Dialog>
}

export function Activate(){
  const {id}=useParams()
  const {state,setNotice}=useStore()
  const [code,setCode]=useState('')
  const [error,setError]=useState('')
  const [record,setRecord]=useState(null)
  const [busy,setBusy]=useState(false)
  useEffect(()=>onSnapshot(doc(db,'cards',id),snapshot=>setRecord({id,...snapshot.data(),exists:snapshot.exists()}),error=>setError(error.message)),[id])
  const card=record?.id===id?record:null
  useEffect(()=>{if(record?.id===id&&record.status==='Claimed')call('track',{username:record.owner,event:'taps'}).catch(()=>{})},[id,record])
  if(!card&&!error)return <main className="shell section" role="status">Loading card…</main>
  if(card?.status==='Claimed')return <Navigate to={'/p/'+card.owner} replace/>
  if(!card?.exists||card.status==='Disabled')return <main className="shell section"><Empty title="Card unavailable"><p>{error||'This card is disabled or its identifier could not be found.'}</p><Button to="/">Back to tap.io</Button></Empty></main>
  async function claim(event){
    event.preventDefault();setBusy(true);setError('')
    try{await cardService.claim(card,code);setNotice('Card connected to your account.')}
    catch(error){setError(error.message)}finally{setBusy(false)}
  }
  return <main className="shell section"><section className="panel auth"><h1>Claim your tap.io</h1><p>{card.name} · {card.id}</p><p>Enter the activation code included with your card to link it to your account.</p>{state.session?<form onSubmit={claim}><Field label="Activation code" value={code} onChange={setCode} required autoComplete="off"/>{error&&<p role="alert" className="error">{error}</p>}<button className="button" disabled={busy}>{busy?'Connecting…':'Claim card'}</button></form>:<div className="actions"><Button to={'/login?claim='+id}>Sign in</Button><Button kind="secondary" to={'/register?claim='+id}>Create account</Button></div>}</section></main>
}
export function Cards({admin=false}){
  const {state,update,setNotice}=useStore()
  const [edit,setEdit]=useState(null)
  const [generated,setGenerated]=useState(null)
  const [name,setName]=useState('')
  const cards=admin?state.cards:state.cards.filter(c=>c.owner===state.account.username)
  const change=(id,values)=>update(current=>({cards:current.cards.map(c=>c.id===id?{...c,...values}:c)}))
  async function status(card,value){try{await cardService.setStatus(card,value);setNotice(value==='Claimed'?'Card reactivated.':'Card deactivated.')}catch(error){setNotice(error.message)}}
  async function copy(id){try{await navigator.clipboard.writeText(publicUrl('/c/'+id));setNotice('Card URL copied.')}catch{setNotice('Copy the URL from the card page.')} }
  async function generate(){try{setGenerated(await cardService.generate('tap.io card','chalk'))}catch(error){setNotice(error.message)}}
  return <main><PageHead title={admin?'NFC Cards':'My NFC Cards'} description="Manage your cards and activation status.">{admin?<Button onClick={generate}>Create card</Button>:<div className="actions"><Button to="/app/shop">Buy cards</Button></div>}</PageHead>{cards.length?<div className="grid-two">{cards.map(c=><article className="panel card-entry" key={c.id}><div className="dashboard-card-art" aria-hidden="true"><NfcCard qrValue={publicUrl('/c/'+c.id)} variant={ownedCardVariant(c)} name={c.owner===state.account.username?state.published[state.active]?.name||state.account.name:c.name} title={c.owner===state.account.username&&state.active==='Professional'?state.published.Professional?.title||null:null}/></div><div className="list-row"><h2>{c.name}</h2><span className="status">{c.status}</span></div><p>{c.id}{c.activated?' · Activated '+c.activated:''}</p><p>Linked profile {c.owner||'—'}</p><div className="actions"><Button kind="secondary" to={'/c/'+c.id}>View URL</Button><Button kind="secondary" onClick={()=>copy(c.id)}>Copy URL</Button>{c.owner&&<Button kind="secondary" to={'/p/'+c.owner} state={{backTo:'/app/cards'}}>Preview Profile</Button>}{!admin&&<Button kind="secondary" onClick={()=>{setEdit({type:'rename',card:c});setName(c.name)}}>Rename</Button>}{c.status!=='Disabled'?<Button kind="secondary" onClick={()=>setEdit({type:'disable',card:c})}>{admin?'Deactivate':'Lost Card?'}</Button>:c.owner&&<Button kind="secondary" onClick={()=>status(c,'Claimed')}>Reactivate</Button>}{!admin&&<Button kind="secondary" onClick={async()=>{try{await cardService.transfer(c.id);setNotice('Transfer request sent to the administrator.')}catch(error){setNotice(error.message)}}}>Request Transfer</Button>}</div></article>)}</div>:<Empty title="No cards yet"><p>Use the activation link supplied with your card, or <Link to="/app/shop">buy a card</Link>.</p></Empty>}{generated&&<Dialog title="Card created" close={()=>setGenerated(null)}><p>Program this URL onto your NFC card.</p><p className="profile-share-url">{publicUrl('/c/'+generated.id)}</p><p>Activation code <strong>{generated.activationCode}</strong></p><p>Save this code before closing. It is shown once and belongs to the person receiving this card.</p><Button onClick={async()=>{try{await navigator.clipboard.writeText(publicUrl('/c/'+generated.id)+'\nActivation code '+generated.activationCode);setNotice('Card details copied.')}catch{setNotice('Select and copy the card details above.')}}}>Copy card details</Button></Dialog>}{edit&&<Dialog title={edit.type==='rename'?'Rename Card':'Disable card?'} close={()=>setEdit(null)}>{edit.type==='rename'?<form onSubmit={async e=>{e.preventDefault();if(name.trim()&&await change(edit.card.id,{name:name.trim()}))setEdit(null)}}><Field label="Card name" value={name} onChange={setName} required/><button className="button">Save Name</button></form>:<><p>This card URL will show an unavailable message.</p><Button onClick={async()=>{await status(edit.card,'Disabled');setEdit(null)}}>Disable Card</Button></>}</Dialog>}</main>
}
export function Orders({admin=false}){
  const {state,setNotice}=useStore()
  const [query,setQuery]=useSearchParams()
  const pendingOnly=query.get('payment')==='pending-proof'
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('All statuses')
  const orders=admin?state.orders.filter(order=>(!pendingOnly||awaitsReview(order))&&(filter==='All statuses'||order.shipping===filter)&&(order.id+' '+order.customer).toLowerCase().includes(search.toLowerCase())):state.orders.filter(order=>order.customerId===state.account.username||(!('customerId' in order)&&order.customer===state.account.name))
  async function change(order,key,value){
    try{await orderService.setStatus(order,key,value)}catch(error){setNotice(error.message)}
  }
  return <main><PageHead title={admin?'Orders':'My Orders'} description="Track your orders and payments."/>{admin&&<div className="grid-two"><Field label="Payment filter" value={pendingOnly?'Pending proof':'All payments'} options={['All payments','Pending proof']} onChange={value=>setQuery(value==='Pending proof'?{payment:'pending-proof'}:{})}/><Field label="Search orders" value={search} onChange={setSearch}/><Field label="Shipping status" value={filter} options={['All statuses','Pending','Packing','Shipped','Delivered']} onChange={setFilter}/></div>}{orders.length?<div className="table-wrap"><table><thead><tr>{['Order','Customer','Products','Amount','Payment','Shipping'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{orders.map(order=><tr key={order.id}><td data-label="Order"><Link to={(admin?'/admin/orders/':'/app/orders/')+order.id}>{order.id}</Link><small>{order.date}</small></td><td data-label="Customer">{order.customer}</td><td data-label="Products">{order.items.map(item=>item.name+' × '+item.quantity).join(', ')}</td><td data-label="Amount">{money(order.total)}</td>{['payment','shipping'].map((key,i)=><td key={key} data-label={i?'Shipping':'Payment'}>{admin&&i===1&&isPaid(order)?<select aria-label={key+' for '+order.id} value={order[key]} onChange={event=>change(order,key,event.target.value)}>{['Pending','Packing','Shipped','Delivered'].map(value=><option key={value}>{value}</option>)}</select>:i?order[key]:paymentLabel(order)}</td>)}</tr>)}</tbody></table></div>:<Empty title="No orders yet"><Button to={admin?"/admin/products":"/app/shop"}>{admin?"View products":"Buy cards"}</Button></Empty>}</main>
}
export function Settings(){
  const {state,update,setNotice}=useStore()
  const [name,setName]=useState(state.account.name)
  const [confirm,setConfirm]=useState(false)
  const [busy,setBusy]=useState(false)
  async function save(event){event.preventDefault();setBusy(true);if(await update(current=>({account:{...current.account,name:name.trim()}})))setNotice('Account updated.');setBusy(false)}
  async function closeAccount(){
    setBusy(true)
    try{await call('closeAccount');await authService.signOut();setConfirm(false)}catch(error){setNotice(error.message)}finally{setBusy(false)}
  }
  return <main><PageHead title="Settings"/><div className="grid-two"><section className="panel"><h2>Account details</h2><form onSubmit={save}><Field label="Display name" value={name} onChange={setName} required/><p>Email · {state.account.email}</p><p>Username · {state.account.username}</p><small>Your username stays fixed so your NFC and profile links keep working.</small><button className="button" disabled={busy}>Save changes</button></form><Button kind="secondary" onClick={async()=>{try{await authService.resetPassword(state.account.email);setNotice('Password reset email sent.')}catch(error){setNotice(error.message)}}}>Change password by email</Button>{!auth.currentUser?.emailVerified&&<Button kind="secondary" onClick={async()=>{try{await authService.verifyEmail();setNotice('Verification email sent.')}catch(error){setNotice(error.message)}}}>Send verification email</Button>}</section><section className="panel"><h2>Close account</h2><p>Remove your public profile and disable your cards. Order records remain available to the store.</p><Button kind="secondary" onClick={()=>setConfirm(true)}>Close account</Button></section></div>{confirm&&<Dialog title="Close your account?" close={()=>setConfirm(false)}><p>Your published profile will become unavailable and your cards will be disabled.</p><Button disabled={busy} onClick={closeAccount}>Confirm account closure</Button></Dialog>}</main>
}
const awaitsReview=order=>Boolean(order.paymentProof)&&!isPaid(order)&&!['Rejected','Demo rejected'].includes(order.payment)
const awaitsShipping=order=>isPaid(order)&&['Pending','Packing'].includes(order.shipping)

export function AdminOverview(){
  const {state}=useStore()
  const attention=state.orders.filter(order=>awaitsReview(order)||awaitsShipping(order))
  return <main><PageHead title="Admin" description="Manage your store, customers, and card activations."/><Stats items={[[ 'Customers',state.customers.length],['Orders',state.orders.length],['Active cards',state.cards.filter(c=>c.status==='Claimed').length],['Unclaimed cards',state.cards.filter(c=>c.status==='Unclaimed').length]]}/><section className="panel dashboard-grid"><h2>Needs attention</h2>{attention.length?<ul>{attention.map(order=><li key={order.id}><Link className="checklist-link" to={'/admin/orders/'+order.id}>{order.id}</Link> · {awaitsReview(order)?'Verify payment proof':'Prepare shipment'}</li>)}</ul>:<p>No orders need attention.</p>}</section></main>
}
function CustomerProfileStatus({username,mode}){
  const [result,setResult]=useState(null)
  useEffect(()=>{
    if(!username||!modes.includes(mode))return
    return onSnapshot(doc(db,'publicProfiles',username,'modes',mode),snapshot=>setResult({username,mode,label:snapshot.exists()?'Published':'Draft'}),()=>setResult({username,mode,label:'Unavailable'}))
  },[username,mode])
  if(!username||!modes.includes(mode))return 'Draft'
  return result?.username===username&&result.mode===mode?result.label:'Loading…'
}
export function Customers(){
  const {state}=useStore()
  const [search,setSearch]=useState('')
  const customers=state.customers.filter(user=>((user.account?.name||'')+' '+(user.account?.email||'')).toLowerCase().includes(search.toLowerCase()))
  return <main><PageHead title="Customers"/><Field label="Search customers" value={search} onChange={setSearch}/>{customers.length?<div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Profile</th><th>Registered</th></tr></thead><tbody>{customers.map(user=><tr key={user.id}><td>{user.account?.name||'Unnamed account'}</td><td>{user.account?.email||'—'}</td><td><CustomerProfileStatus username={user.account?.username} mode={user.active}/></td><td>{typeof user.account?.createdAt==='string'?user.account.createdAt.slice(0,10):'—'}</td></tr>)}</tbody></table></div>:<Empty title="No matching customers"/>}</main>
}
export function Products(){
  const {state,update,setNotice}=useStore()
  const [item,setItem]=useState(null)
  async function save(event){
    event.preventDefault()
    if(!item.name.trim()||item.price===''||Number(item.price)<0)return
    try{
    const product=await adminService.saveProduct({...item,name:item.name.trim(),price:Number(item.price),stock:item.stock===''||item.stock===undefined?undefined:Math.max(0,Math.floor(Number(item.stock)))})
    setItem(null);setNotice(product.name+' saved.')
    }catch(error){setNotice(error.message)}
  }
  return <main><PageHead title="Products" description="Manage card finishes, prices, and stock.">{!state.products.length&&<Button kind="secondary" onClick={async()=>{try{await adminService.initializeCatalog();setNotice('Starter catalog added. Review prices and stock before selling.')}catch(error){setNotice(error.message)}}}>Add starter catalog</Button>}<Button onClick={()=>setItem({name:'',description:'',price:'',colors:'',tone:'chalk',available:true})}>Add Product</Button></PageHead><div className="grid-two">{state.products.map(p=><article key={p.id} className="panel"><h2>{p.name}</h2><p>{money(p.price)} · {p.available?'Available':'Unavailable'}{p.stock!==undefined?' · '+p.stock+' in stock':''}</p><div className="actions"><Button kind="secondary" onClick={()=>setItem({...p})}>Edit Product</Button><Button kind="secondary" onClick={()=>update({products:state.products.map(product=>product.id===p.id?{...product,available:!product.available}:product)})}>{p.available?'Set Unavailable':'Set Available'}</Button></div></article>)}</div>{item&&<Dialog title={item.id?'Edit Product':'Add Product'} close={()=>setItem(null)}><form onSubmit={save}>{[['name','Name','text'],['description','Description','textarea'],['price','Price (PHP)','number'],['colors','Colors','text'],['stock','Stock','number']].map(([key,label,type])=><Field key={key} label={label} value={item[key]} onChange={value=>setItem({...item,[key]:value})} type={type} required={key==='name'||key==='price'}/>)}<Field label="Card finish" value={item.tone} options={['chalk','onyx','cobalt']} onChange={tone=>setItem({...item,tone})}/><button className="button">Save Product</button></form></Dialog>}</main>
}
export function Payments(){
  const {state,update,setNotice}=useStore()
  const [filter,setFilter]=useState('Pending proofs')
  const orders=filter==='Pending proofs'?state.orders.filter(awaitsReview):state.orders
  const [number,setNumber]=useState(state.paymentDetails.number)
  useEffect(()=>setNumber(state.paymentDetails.number),[state.paymentDetails.number])
  async function qrChange(event){try{const file=event.target.files?.[0];if(file)update({paymentDetails:{...state.paymentDetails,qr:await compressImage(file)}})}catch(error){setNotice(error.message)}event.target.value=''}
  return <main><PageHead title="Payments" description="Manual GCash payment settings."/><div className="grid-two"><section className="panel"><h2>GCash details</h2><p>Add the GCash number and QR image customers should use to pay.</p><form onSubmit={async event=>{event.preventDefault();if(await update({paymentDetails:{...state.paymentDetails,number:number.trim()}}))setNotice('Payment details saved.')}}><Field label="GCash number" value={number} onChange={setNumber} placeholder="Not configured"/><label className="field"><span>GCash QR image</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={qrChange}/></label>{state.paymentDetails.qr&&<><CloudImage className="payment-qr" src={state.paymentDetails.qr} alt="GCash QR"/><Button kind="secondary" onClick={()=>update({paymentDetails:{...state.paymentDetails,qr:''}})}>Remove QR</Button></>}<button className="button">Save GCash number</button></form></section><section className="panel"><h2>Verification queue</h2><Field label="Show payments" options={['Pending proofs','All payments']} value={filter} onChange={setFilter}/>{orders.length?orders.map(order=><div className="list-row" key={order.id}><Link to={'/admin/orders/'+order.id}>{order.id}</Link><span>{money(order.total)} · {paymentLabel(order)}</span></div>):<p>No payments match this filter.</p>}<div className="actions"><Button to="/admin/orders" kind="secondary">Review orders</Button></div></section></div></main>
}

export function SignedInChat(){
  const {state}=useStore()
  const {pathname}=useLocation()
  if(!state.session)return null
  return <ChatDock key={state.session} role={state.session} pathname={pathname}/>
}

function ChatDock({role,pathname}){
  const {state,update,setNotice}=useStore()
  const admin=role==='admin'
  const [expanded,setExpanded]=useState(false)
  const [windowKey,setWindowKey]=useState(0)
  const launcher=useRef(null)
  const lastNotified=useRef(null)
  const fullPage=pathname.replace(/\/$/,'')===(admin?'/admin/messages':'/app/messages')
  const receiving=state.messages.filter(message=>message.sender!==role)
  const seen=state.messageRead[role]
  const seenIndex=receiving.findIndex(message=>message.id===seen)
  const unread=admin?receiving.filter(message=>{const thread=receiving.filter(item=>item.ownerUid===message.ownerUid);const lastSeen=thread.findIndex(item=>item.id===state.messageRead[message.ownerUid]);return thread.indexOf(message)>lastSeen}).length:receiving.length-seenIndex-1
  const latest=receiving.at(-1)?.id
  const reading=expanded||fullPage

  useEffect(()=>{
    if(!latest)return
    if(reading){
      lastNotified.current=latest
      if(unread&&!admin)update(current=>({messageRead:{...current.messageRead,[role]:latest}}))
    }else if(unread&&lastNotified.current!==latest){
      lastNotified.current=latest
      setNotice(unread===1?'You have a new message.':`You have ${unread} unread messages.`)
    }
  },[latest,reading,role,unread,update,setNotice,admin])

  function minimize(){
    setExpanded(false)
    requestAnimationFrame(()=>launcher.current?.focus())
  }
  if(fullPage)return null
  const workspace=/^\/(app|admin)(\/|$)/.test(pathname)
  const builder=/^\/app\/builder(\/|$)/.test(pathname)
  return <div className={['chat-dock',workspace&&'chat-dock-workspace',builder&&'chat-dock-builder'].filter(Boolean).join(' ')} onKeyDown={event=>{if(event.key==='Escape'&&expanded){event.stopPropagation();minimize()}}}>
    <div id="dashboard-chat" hidden={!expanded}>
      <Messages key={windowKey} admin={admin} compact active={expanded} onMinimize={minimize} onClose={()=>{minimize();setWindowKey(key=>key+1)}}/>
    </div>
    {!expanded&&<button ref={launcher} type="button" className="button chat-launcher" aria-label={unread?`Help, ${unread} unread ${unread===1?'message':'messages'}`:'Help'} aria-expanded={false} aria-controls="dashboard-chat" onClick={()=>setExpanded(true)}>
      <MessageCircle size={19} aria-hidden="true"/> Help
      {unread>0&&<span className="chat-unread" aria-hidden="true">{unread>99?'99+':unread}</span>}
    </button>}
  </div>
}

export function Messages({admin=false,compact=false,active=true,onMinimize,onClose}){
  const {state,update,setNotice}=useStore()
  const [message,setMessage]=useState('')
  const [attachment,setAttachment]=useState('')
  const [thread,setThread]=useState('')
  const [sending,setSending]=useState(false)
  const conversationUid=admin?(thread||state.messages.at(-1)?.ownerUid||state.customers.find(user=>user.id!==state.account.uid)?.id):state.account.uid
  const conversation=state.messages.filter(item=>item.ownerUid===conversationUid)
  const lastIncoming=conversation.filter(item=>item.sender!==(admin?'admin':'customer')).at(-1)?.id
  useEffect(()=>{
    if(active&&admin&&lastIncoming&&state.messageRead[conversationUid]!==lastIncoming)update(current=>({messageRead:{...current.messageRead,[conversationUid]:lastIncoming}}))
  },[active,admin,lastIncoming,conversationUid,state.messageRead,update])
  const history=useRef(null)
  const minimizeButton=useRef(null)
  useEffect(()=>{
    if(active&&history.current)history.current.scrollTop=history.current.scrollHeight
  },[active,state.messages.length])
  useEffect(()=>{
    if(compact&&active)minimizeButton.current?.focus()
  },[active,compact])
  const Layout=compact?'section':'main'
  const title=admin?'Customer conversation':'tap.io support'
  async function attach(event){
    const input=event.currentTarget
    const file=input.files?.[0]
    input.value=''
    try{if(file)setAttachment(await compressImage(file))}
    catch(error){setNotice(error.message)}
  }
  async function send(event){
    event.preventDefault()
    if(sending||(!message.trim()&&!attachment)||!conversationUid)return
    setSending(true)
    const item={id:crypto.randomUUID(),ownerUid:conversationUid,sender:admin?'admin':'customer',text:message.trim(),image:attachment,createdAt:new Date().toISOString()}
    if(await update(current=>({messages:[...current.messages,item]}))){setMessage('');setAttachment('')}
    setSending(false)
  }
  return <Layout className={compact?'floating-chat':'messages-page'} aria-label={compact?'Messages':undefined}>
    {!compact&&<PageHead title="Messages"/>}
    <header className="chat-heading">
      <span className="chat-avatar" aria-hidden="true"><MessageCircle size={19}/></span>
      <div className="chat-title"><h2>{title}</h2><small>Messages sync across your devices</small></div>
      {compact&&<div className="chat-window-actions">
        <Link className="icon" to={admin?'/admin/messages':'/app/messages'} aria-label="Open full Messages page"><Maximize2 size={16}/></Link>
        <button ref={minimizeButton} type="button" className="icon" aria-label="Minimize chat" onClick={onMinimize}><Minus size={19}/></button>
        <button type="button" className="icon" aria-label="Close chat" onClick={onClose}><X size={19}/></button>
      </div>}
    </header>
    {admin&&<label className="field"><span>Customer</span><select value={conversationUid||''} onChange={event=>setThread(event.target.value)}><option value="" disabled>Select a customer</option>{state.customers.filter(user=>user.id!==state.account.uid).map(user=><option key={user.id} value={user.id}>{user.account.name} · {user.account.username}</option>)}</select></label>}
    <div ref={history} className="chat-history" role="log" aria-label="Conversation">
      {conversation.length?conversation.map(item=><article className={'chat-bubble '+(item.sender===(admin?'admin':'customer')?'chat-mine':'')} key={item.id}>
        <small>{item.sender==='admin'?'tap.io admin':'Customer'}</small>
        {item.text&&<p>{item.text}</p>}
        {item.image&&<CloudImage src={item.image} alt="Chat attachment"/>}
      </article>):<p className="chat-empty">No messages yet.</p>}
    </div>
    <form className="chat-compose" onSubmit={send}>
      {attachment&&<div className="chat-attachment"><CloudImage src={attachment} alt="Selected image"/><button type="button" className="icon" aria-label="Remove attachment" onClick={()=>setAttachment('')}><X size={18}/></button></div>}
      <div className="chat-input-row">
        <label className="icon chat-attach"><ImagePlus size={21} aria-hidden="true"/><input type="file" aria-label="Attach image" accept="image/png,image/jpeg,image/webp,image/gif" onChange={attach}/></label>
        <input aria-label="Your message" value={message} onChange={event=>setMessage(event.target.value)} placeholder="Aa" maxLength={2000}/>
        <button className="icon chat-send" type="submit" aria-label="Send message" disabled={sending||!conversationUid||(!message.trim()&&!attachment)}><Send size={20}/></button>
      </div>
    </form>
  </Layout>
}
