import {CloudImage} from './CloudImage'
import {useLayoutEffect,useRef} from 'react'
import {QRCodeSVG} from 'qrcode.react'
import {BRAND} from './brand'

function Mark(){
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="nfc-mark" fill="currentColor"><circle cx="12" cy="12" r="12" opacity=".14"/><circle cx="9" cy="15" r="2.6"/><path d="M9 9.2a5.8 5.8 0 0 1 5.8 5.8M9 4.8A10.2 10.2 0 0 1 19.2 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
}
function Waves(){
  return <svg viewBox="0 0 16 16" aria-hidden="true" className="nfc-waves" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 5a5 5 0 0 1 0 6M7 3a8 8 0 0 1 0 10M11 1a11 11 0 0 1 0 14"/></svg>
}
function Ripples(){
  return <svg className="nfc-ripples" viewBox="0 0 100 63" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke="currentColor">{[[16,.9],[29,.75],[44,.6],[61,.5],[80,.4],[101,.3]].map(([radius,width])=><circle key={radius} cx="100" cy="63" r={radius} strokeWidth={width}/>)}</svg>
}
export default function NfcCard({variant='classic',name,title,logoSrc,colorA='#3f46c4',colorB='#1a1d6b',flipped=false,onFlip,qrValue}){
  const faceRef=useRef(null)
  const nameRef=useRef(null)
  useLayoutEffect(()=>{
    let disposed=false
    function fit(){
      if(disposed||!faceRef.current||!nameRef.current)return
      const nameElement=nameRef.current
      let size=11
      nameElement.style.fontSize=size+'cqw'
      while(nameElement.scrollWidth>nameElement.clientWidth&&size>5.5){
        size=Math.max(5.5,Math.round((size-.2)*10)/10)
        nameElement.style.fontSize=size+'cqw'
      }
    }
    fit()
    const observer=new ResizeObserver(fit)
    observer.observe(faceRef.current)
    document.fonts?.ready.then(fit)
    return ()=>{disposed=true;observer.disconnect()}
  },[name])
  const style={'--a':colorA,'--b':colorB,'--flip':flipped?1:0,'--custom-shade':colorA.toLowerCase()==='#bfa05a'?.3:0}
  return <div className={'nfc-card nfc-card--'+variant} style={style} onClick={onFlip}>
    <div ref={faceRef} className="nfc-face nfc-front" aria-hidden={flipped}>
      <Ripples/><div className="nfc-person"><div ref={nameRef} className="nfc-name">{name||'Your Name'}</div>{title!==null&&<div className="nfc-title">{title||'Your title'}</div>}</div><Waves/>
      <div className="nfc-brand">{logoSrc?<CloudImage className="nfc-uploaded-logo" src={logoSrc} alt=""/>:<Mark/>}<span>{BRAND}</span></div>
    </div>
    <div className="nfc-face nfc-back" aria-hidden={!flipped}>
      <Ripples/><div className="nfc-back-brand"><Mark/><span>{BRAND}</span></div>
      <div className="nfc-qr"><QRCodeSVG value={qrValue||"https://tap.io"} level="M" size={128} title={qrValue?"Card QR code":"Example QR code"}/>{!qrValue&&<small className="qr-example">Example</small>}</div>
      <div className="nfc-back-message">Tap or scan<br/>to connect</div>
    </div>
  </div>
}
