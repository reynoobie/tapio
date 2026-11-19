import {Link,NavLink,useLocation} from 'react-router-dom'
import {ArrowLeft,ArrowUpRight, Radio, Nfc, X} from 'lucide-react'
import {safeLink} from './data'

export const pretty = value => value.replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase())
export function BackNavigation({workspace=false}){
  const {pathname}=useLocation()
  if(!workspace && pathname==='/')return null
  let to='/',label='Home'
  if(workspace){
    const admin=pathname.startsWith('/admin')
    const base=admin?'/admin':'/app'
    if(pathname===base||pathname===base+'/')return null
    if(new RegExp('^'+base+'/orders/[^/]+/?$').test(pathname)){to=base+'/orders';label='Orders'}
    else if(pathname==='/app/checkout'){to='/app/cart';label='Cart'}
    else if(pathname==='/app/cart'||pathname.startsWith('/app/shop/')){to='/app/shop';label='Buy cards'}
    else if(pathname.startsWith(base+'/builder/')){to=base+'/profiles';label='My Profiles'}
    else{to=base;label='Home'}
  }else if(/^\/shop\/[^/]+/.test(pathname)){to='/shop';label='Shop'}
  else if(pathname==='/checkout'){to='/cart';label='Cart'}
  else if(pathname==='/cart'||pathname.startsWith('/order-confirmation/')){to='/shop';label='Shop'}
  else if(pathname==='/forgot-password'){to='/login';label='Login'}
  return <div className={'back-nav'+(workspace?' back-nav--workspace':' shell')}><Link to={to} className="back-nav-link"><ArrowLeft size={17} aria-hidden="true"/> Back to {label}</Link></div>
}
export function Logo(){return <Link to="/" className="logo" aria-label="tap.io home"><span><Radio size={20}/></span>tap<span className="logo-dot">.</span>io</Link>}
export function Button({to,children,kind='',className='',...props}){
  const classes='button '+kind+' '+className
  return to ? <Link to={to} className={classes} {...props}>{children}</Link> : <button className={classes} type="button" {...props}>{children}</button>
}
export function CardArt({tone='onyx',large=false,mark,name,placement}){
  return <div className={'card-art '+tone+(large?' large':'')} aria-hidden="true"><div><Radio/> tap.io</div><Nfc className="card-nfc"/>{mark&&<img src={mark} className="custom-mark" alt=""/>}{name&&<strong className={'custom-name '+(placement==='Center'?'center':'')}>{name}</strong>}<small>NFC DIGITAL CARD</small></div>
}
export function Dialog({title,children,close,className=''}){
  return <dialog ref={element=>{if(element&&!element.open)element.showModal()}} onCancel={close} className={'dialog '+className} aria-label={title}>
    <div className="dialog-head"><h2>{title}</h2><button type="button" aria-label="Close dialog" className="icon" onClick={close}><X size={20}/></button></div>{children}
  </dialog>
}
export function Field({label,value,onChange,type='text',options,required=false,placeholder,autoComplete,onBlur,rows,name,maxLength}){
  return <label className="field"><span>{label}</span>{options ?
    <select value={value} onChange={event=>onChange(event.target.value)}>{options.map(item=><option key={item}>{item}</option>)}</select> :
    type==='textarea' ? <textarea name={name} maxLength={maxLength} rows={rows} onBlur={onBlur} placeholder={placeholder} required={required} value={value??''} onChange={event=>onChange(event.target.value)}/> :
    <input name={name} maxLength={maxLength} onBlur={onBlur} placeholder={placeholder} autoComplete={autoComplete} required={required} type={type} value={value??''} onChange={event=>onChange(event.target.value)}/>}</label>
}
export function Empty({title,children}){return <div className="empty"><h2>{title}</h2>{children}</div>}
export function NavItems({items}){return items.map(([label,to])=><NavLink key={to} end={to==='/app'||to==='/admin'||to==='/'} to={to}>{label}</NavLink>)}
export function ProfileLink({url,children}){const href=safeLink(url);return href?<a href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={15}/></a>:null}
