import {lazy,Suspense,useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter,HashRouter,Navigate,Outlet,Route,Routes,useLocation} from 'react-router-dom'
import toast,{Toaster} from 'react-hot-toast'
import {Store,useStore} from './store'
import {Auth,Cart,Compatibility,Footer,Header,Home,How,Shop} from './marketing'
import {BackNavigation,Button,Empty} from './ui'
import {SiteTheme} from './site-theme'
import {pagesRouting} from './lib/urls'
import './style.css'
import './redesign.css'
import './profile-experience.css'

const load=loader=>name=>lazy(()=>loader().then(module=>({default:module[name]})))
const profiles=load(()=>import('./profile'))
const dashboard=load(()=>import('./dashboard'))
const commerce=load(()=>import('./commerce'))
const Builder=profiles('Builder')
const PublicProfile=load(()=>import('./public-profile'))('PublicProfile')
const Workspace=dashboard('Workspace')
const SignedInChat=dashboard('SignedInChat')
const Activate=dashboard('Activate')
const CustomerOverview=dashboard('CustomerOverview')
const Profiles=dashboard('Profiles')
const Cards=dashboard('Cards')
const Orders=dashboard('Orders')
const Settings=dashboard('Settings')
const AdminOverview=dashboard('AdminOverview')
const Customers=dashboard('Customers')
const Products=dashboard('Products')
const Payments=dashboard('Payments')
const Messages=dashboard('Messages')
const ProductDetail=commerce('ProductDetail')
const Checkout=commerce('Checkout')
const OrderDetail=commerce('OrderDetail')
const Onboarding=load(()=>import('./onboarding'))('Onboarding')
const Analytics=lazy(()=>import('./analytics'))

function ChatOverlay(){
  const {state}=useStore()
  return state.session?<Suspense fallback={null}><SignedInChat/></Suspense>:null
}

function HomeEntry(){
  const {state}=useStore()
  if(!state.authReady)return <main className="shell section" role="status">Loading your account…</main>
  if(state.session)return <Navigate replace to={state.session==='admin'?'/admin':'/app'}/>
  return <Home/>
}
function PublicLayout(){return <div className="public-layout"><Header/><BackNavigation/><Outlet/><Footer/></div>}
function Feedback(){
  const {state,notice,setNotice}=useStore()
  const {pathname,hash}=useLocation()
  useEffect(()=>{if(hash){requestAnimationFrame(()=>document.getElementById(hash.slice(1))?.scrollIntoView());return}window.scrollTo(0,0)},[pathname,hash])
  useEffect(()=>{if(!notice)return;toast(notice);setNotice('')},[notice,setNotice])
  return <>{state.syncError&&<div className="builder-banner" role="alert">{state.syncError}</div>}<Toaster position="top-center" toastOptions={{duration:4000,style:{background:'#191922',color:'white'}}}/></>
}
function Legacy(){
  const {pathname,search,hash}=useLocation()
  return <Navigate replace to={pathname.replace(/^\/dashboard(?=\/|$)/,'/app').replace(/^\/u\//,'/p/').replace(/^\/builder$/,'/try-builder')+search+hash}/>
}
const Router=pagesRouting?HashRouter:BrowserRouter
function App(){
  return <Store><Router><SiteTheme><Suspense fallback={<main className="shell section"><p role="status">Loading tap.io…</p></main>}><Routes>
    <Route element={<PublicLayout/>}>
      <Route index element={<HomeEntry/>}/><Route path="/shop" element={<Shop/>}/><Route path="/shop/:productId" element={<ProductDetail/>}/><Route path="/how-it-works" element={<How/>}/><Route path="/check-compatibility" element={<Compatibility/>}/><Route path="/cart" element={<Navigate to="/app/cart" replace/>}/><Route path="/checkout" element={<Navigate to="/app/checkout" replace/>}/><Route path="/order-confirmation/:orderId" element={<OrderDetail confirmation/>}/>
      <Route path="/try-builder" element={<Builder demo/>}/><Route path="/login" element={<Auth key="login" kind="Login"/>}/><Route path="/register" element={<Auth key="register" kind="Register"/>}/><Route path="/forgot-password" element={<Auth key="forgot" kind="Forgot Password"/>}/><Route path="/c/:id" element={<Activate/>}/>
      <Route path="*" element={<main className="shell section"><Empty title="Page not found"><p>Use the menu to find the shop, builder, or your dashboard.</p><Button to="/">Back to tap.io</Button></Empty></main>}/>
    </Route>
    <Route path="/builder" element={<Legacy/>}/><Route path="/dashboard/*" element={<Legacy/>}/><Route path="/u/:username" element={<Legacy/>}/><Route path="/p/:username" element={<PublicProfile/>}/>
    <Route path="/app" element={<Workspace/>}><Route index element={<CustomerOverview/>}/><Route path="profiles" element={<Profiles/>}/><Route path="builder/:mode?" element={<Builder/>}/><Route path="cards" element={<Cards/>}/><Route path="shop" element={<Shop accountShop/>}/><Route path="shop/:productId" element={<ProductDetail accountShop/>}/><Route path="cart" element={<Cart/>}/><Route path="checkout" element={<Checkout/>}/><Route path="orders" element={<Orders/>}/><Route path="orders/:orderId" element={<OrderDetail/>}/><Route path="messages" element={<Messages/>}/><Route path="analytics" element={<Analytics/>}/><Route path="settings" element={<Settings/>}/><Route path="onboarding" element={<Onboarding/>}/></Route>
    <Route path="/admin" element={<Workspace admin/>}><Route index element={<AdminOverview/>}/><Route path="customers" element={<Customers/>}/><Route path="products" element={<Products/>}/><Route path="orders" element={<Orders admin/>}/><Route path="orders/:orderId" element={<OrderDetail admin/>}/><Route path="cards" element={<Cards admin/>}/><Route path="payments" element={<Payments/>}/><Route path="messages" element={<Messages admin/>}/><Route path="settings" element={<Settings admin/>}/></Route>
  </Routes></Suspense><ChatOverlay/><Feedback/></SiteTheme></Router></Store>
}
createRoot(document.getElementById('root')).render(<App/>)
