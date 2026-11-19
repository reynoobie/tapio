import {CloudImage,useImageUrl} from './components/CloudImage'
import {useEffect,useState} from 'react'
import {Link,useLocation,useParams} from 'react-router-dom'
import {ArrowLeft,AtSign,Briefcase,CalendarDays,Contact,FileText,Globe,Image,Link2,Mail,MapPin,Music,Package,PenLine,Phone,QrCode,Share2,ShoppingBag,UserRound} from 'lucide-react'
import {doc,onSnapshot} from 'firebase/firestore'
import {db,call} from './lib/firebase'
import {imagePrefix} from './lib/firestore-actions'
import {publicUrl} from './lib/urls'
import {safeLink} from './data'
import {useStore} from './store'
import {Button,Dialog,Empty,Field,ProfileLink} from './ui'
import {contrast,readableInk} from './themes'
import {ShareProfile} from './share'
import {saveContact} from './lib/vcf'
import {SocialIcon} from './social-icons'
import {ThemeToggle,useSiteTheme} from './site-theme'
const image = value => value?.startsWith(imagePrefix)||/^data:image\/(png|jpeg|webp|gif);base64,/.test(value||'') ? value : safeLink(value)
function formatPhone(phone){
  if(!phone)return ''
  const digits=phone.replace(/\D/g,'')
  const local=digits.match(/^(?:63|0)?(9\d{2})(\d{3})(\d{4})$/)
  return local?'+63 '+local.slice(1).join(' '):phone
}

export function ProfileView({profile:p,mode,publicView=false,onEdit,editing=false}){
  const {setNotice,state,update}=useStore()
  const {theme:siteTheme}=useSiteTheme()
  const [sharing,setSharing]=useState(false)
  const [returnContact,setReturnContact]=useState('')
  const [contactInfo,setContactInfo]=useState({name:'',email:''})
  const visibleContact=Object.fromEntries(['email','phone','website'].map(key=>[key,(!p.privacy?.[key]||p.privacy[key]==='Public')?p[key]:'']))
  const NameHeading=publicView?'h1':'h2'
  onEdit=publicView?undefined:onEdit
  const professional=mode==='Professional'
  const custom=p.theme==='Custom'
  const accent=p.accent||'#5267e8'
  const resolvedBackground=useImageUrl(image(p.backgroundImage))
  const backgroundImage=p.background==='Uploaded image'&&resolvedBackground
  const accessibleInk=(color,background)=>color&&contrast(color,background)>=4.5
    ?color:contrast('#000000',background)>=4.5?'#000000':readableInk(background)
  const profileTheme=publicView&&siteTheme==='dark'&&!custom?'Dark':p.theme
  const style={
    '--p-accent':accent,
    '--p-custom-bg':custom?p.color:undefined,
    '--p-custom-surface':custom?p.card:undefined,
    '--p-custom-border':custom?p.border:undefined,
    '--p-custom-ink':custom&&p.color?accessibleInk(p.text,p.color):undefined,
    '--p-custom-card-ink':custom&&p.card?accessibleInk(p.text,p.card):undefined,
    '--p-button':p.button||accent,
    '--p-button-text':accessibleInk(null,p.button||accent),
    '--p-radius':p.shape==='Square'?'0px':p.shape==='Pill'?'999px':'10px',
    '--profile-background':p.background==='Gradient'?'linear-gradient(145deg, var(--profile-tint), color-mix(in srgb,var(--profile-tint) 94%,var(--p-accent)))':backgroundImage?'linear-gradient(var(--profile-veil),var(--profile-veil)),url('+JSON.stringify(backgroundImage)+')':undefined,
    fontFamily:p.font+', sans-serif',
  }
  const contactRows=[
    [Mail,visibleContact.email,visibleContact.email?'mailto:'+visibleContact.email.replace(/[\r\n]/g,''):''],
    [Phone,formatPhone(visibleContact.phone),visibleContact.phone?'tel:'+visibleContact.phone.replace(/[^+\d]/g,''):''],
    [Globe,visibleContact.website,safeLink(visibleContact.website)],
  ].filter(([,value,href])=>value&&href)
  const icons={'About':UserRound,'Social Links':AtSign,'Link Buttons':Link2,'Gallery':Image,'Portfolio':Briefcase,'Projects':FileText,'Services':Briefcase,'Products':ShoppingBag,'Contact Information':Contact,'Music':Music,'Featured Content':FileText,'Business Information':Package}
  const priority=professional?['Portfolio','Link Buttons','Contact Information']:['Social Links','About']
  const order=type=>priority.includes(type)?priority.indexOf(type):priority.length
  const visibleSections=p.sections.map((section,index)=>({section,index})).filter(({section})=>!section.hidden)
  if(publicView)visibleSections.sort((a,b)=>order(a.section.type)-order(b.section.type))
  const activate=(name,index,key)=>()=>onEdit?.(name,index,key)
  const identity=(key,value)=>onEdit?<button className="preview-text-target" type="button" onClick={activate('Profile',undefined,key)} aria-label={'Focus '+key+' field'}>{value}</button>:value
  const profilePath=publicView?'/p/'+p.username:'/p/'+state.account.username
  async function share(){
    const url=publicUrl(profilePath)
    try{if(navigator.share){await navigator.share({title:p.name||'tap.io profile',url});return}}
    catch(error){if(error.name==='AbortError')return}
    setSharing(true)
  }
  const layout=({'Bento Grid':'bento',Centered:'centered',Compact:'compact'})[p.layout]||'stack'
  return <article onClick={event=>{if(publicView&&event.target.closest('a[href]'))call('track',{username:p.username,event:'links'}).catch(()=>{})}} className={`digital-profile polished-profile layout-${layout}${profileTheme==='Dark'?' profile-dark':profileTheme==='Light'?' profile-light':''}${custom?' profile-custom':''}${backgroundImage?' profile-photo-background':''}`} style={style}>
    <div className="profile-cover">{image(p.cover)&&<CloudImage src={image(p.cover)} alt=""/>}</div>
    <div className="profile-avatar">{image(p.avatar)?<CloudImage src={image(p.avatar)} alt=""/>:<UserRound size={30}/>}</div>
    <NameHeading className="profile-name">{identity('name',p.name||'Your name')}</NameHeading>
    {!professional&&p.username&&<small className="profile-subtitle">@{p.username}</small>}
    {professional&&(p.title||p.company)&&<p className="profile-subtitle">{[p.title,p.company].filter(Boolean).join(' · ')}</p>}
    {p.location&&<p className="profile-location"><MapPin size={15} aria-hidden="true"/>{p.location}</p>}
    {(p.bio||onEdit)&&<p className="profile-bio">{identity('bio',p.bio||'Add a short bio')}</p>}
    <div className="profile-primary-actions">
      {<button className="profile-save-contact" type="button" onClick={()=>{saveContact({...p,...visibleContact});if(publicView)call('track',{username:p.username,event:'contacts'}).catch(()=>{})}}><Contact size={18} aria-hidden="true"/> Save Contact</button>}
      <div className="profile-secondary-actions"><Button kind="secondary" onClick={share}><Share2 size={16} aria-hidden="true"/> Share</Button><Button kind="secondary" onClick={()=>setSharing(true)}><QrCode size={16} aria-hidden="true"/> QR</Button></div>
    </div>
    <div className={'profile-sections '+layout}>{visibleSections.map(({section,index})=>{
      const type=section.type
      const Icon=icons[type]||CalendarDays
      const list=(type==='Social Links'?p.links:p.buttons).filter(link=>safeLink(link.url))
      const social=type==='Social Links'
      const isContact=type==='Contact Information'
      const gallery=type==='Gallery'&&image(section.image)
      const empty=social||type==='Link Buttons'?!list.length:isContact?!contactRows.length:!(section.body?.trim()||gallery||safeLink(section.url))
      if(empty&&!onEdit)return null
      const heading=<><Icon size={18} aria-hidden="true"/>{type}</>
      return <section key={section.id} className={social?'profile-social-section':isContact?'profile-contact-section':undefined}>
        <h3>{onEdit?<button type="button" className="preview-text-target" onClick={activate(type,index)}>{heading}</button>:heading}</h3>
        {editing&&onEdit&&<button type="button" className="profile-pencil icon" aria-label={'Edit '+type} onClick={activate(type,index)}><PenLine size={15}/></button>}
        {empty?<p>{social||type==='Link Buttons'?'Add your first link.':isContact?'Add your contact details.':'Add something to this section.'}</p>:social?<div className="profile-social-icons">{list.map((link,i)=><a key={i} href={safeLink(link.url)} target="_blank" rel="noreferrer" aria-label={link.platform&&link.platform!=='Custom'?link.platform:link.label||new URL(safeLink(link.url)).hostname}><SocialIcon link={link}/></a>)}</div>:type==='Link Buttons'?<div className="profile-links">{list.map((link,i)=><ProfileLink key={i} url={link.url}>{link.label||'Open link'}</ProfileLink>)}</div>:isContact?<div className="profile-contact-rows">{contactRows.map(([RowIcon,value,href])=><a key={href} href={href} title={value} target={RowIcon===Globe?'_blank':undefined} rel="noreferrer"><RowIcon size={17} aria-hidden="true"/><span>{value}</span></a>)}</div>:<>{section.body&&<p>{section.body}</p>}{gallery&&<CloudImage loading="lazy" className="gallery-image" src={gallery} alt="Profile gallery"/>}<ProfileLink url={section.url}>{section.linkLabel||'Open link'}</ProfileLink></>}
      </section>
    })}</div>
    {publicView&&mode==='Professional'&&p.contactBack&&<Button kind="secondary" onClick={()=>setReturnContact('Share your contact')}>Share Your Contact</Button>}
    {publicView&&mode==='Professional'&&Object.values(p.privacy||{}).includes('Request access')&&<Button kind="secondary" onClick={()=>setReturnContact('Request contact details')}>Request Contact Details</Button>}
    <div className="profile-brand"><Link to="/">Made with tap.io.</Link></div>
    {sharing&&<ShareProfile path={profilePath} close={()=>setSharing(false)}/>}
    {returnContact&&<Dialog title={returnContact} close={()=>setReturnContact('')}><p>Share your details with this profile owner.</p><form onSubmit={async event=>{event.preventDefault();if(!contactInfo.name.trim())return;try{await call('contact',{...contactInfo,username:p.username,request:returnContact});setReturnContact(false);setNotice('Contact request sent.')}catch(error){setNotice(error.message)}}}><Field label="Your name" value={contactInfo.name} required onChange={name=>setContactInfo({...contactInfo,name})}/><Field label="Your email" type="email" value={contactInfo.email} required onChange={email=>setContactInfo({...contactInfo,email})}/><button className="button">Share Contact</button></form></Dialog>}
  </article>
}
export function PublicProfile(){
  const {username}=useParams()
  const {state:routeState}=useLocation()
  const {state}=useStore()
  const [loaded,setLoaded]=useState(null)
  useEffect(()=>{
    let stopMode=()=>{}
    const fail=error=>setLoaded({username,error:error.message})
    const stop=onSnapshot(doc(db,'publicProfiles',username),snapshot=>{
      stopMode()
      const root=snapshot.data()
      if(!root){setLoaded({username,data:null});return}
      setLoaded(null)
      stopMode=onSnapshot(doc(db,'publicProfiles',username,'modes',root.active),mode=>setLoaded({username,data:{...root,profile:mode.data()?.profile}}),fail)
    },fail)
    return ()=>{stop();stopMode()}
  },[username])
  const record=loaded?.username===username?loaded:null
  const published=record?.data?.profile
  useEffect(()=>{
    if(!published)return
    const previous=document.title
    document.title=published.name+' · tap.io'
    const robots=published.unlisted?document.createElement('meta'):null
    if(robots){robots.name='robots';robots.content='noindex';document.head.append(robots)}
    return ()=>{document.title=previous;robots?.remove()}
  },[published])
  const backTo=routeState?.backTo==='/app/cards'?'/app/cards':state.session==='customer'?'/app':state.session==='admin'?'/admin':'/'
  return <main className="public-profile"><div className="profile-theme-toggle"><Button kind="secondary" to={backTo}><ArrowLeft size={16} aria-hidden="true"/> {backTo==='/'?'Back to website':backTo==='/app/cards'?'Back to cards':'Back to account'}</Button><ThemeToggle/></div>{!record?<p role="status">Loading profile…</p>:published?<ProfileView profile={{...published,username}} mode={record.data.active} publicView/>:<Empty title="Profile unavailable"><p>{record.error||'This profile may be unpublished or the link may have changed.'}</p><Button to="/">Go to tap.io</Button></Empty>}</main>
}
