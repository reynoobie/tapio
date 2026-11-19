import {useRef} from 'react'
import {QRCodeCanvas} from 'qrcode.react'
import {Button,Dialog} from './ui'
import {publicUrl} from './lib/urls'
import {useStore} from './store'
export function ShareProfile({path,title='Share your profile',close,children}){
  const canvas=useRef(null)
  const {setNotice,update}=useStore()
  const url=publicUrl(path)
  function markShared(){update(current=>({account:{...current.account,shared:true}}))}
  async function copy(){
    try{await navigator.clipboard.writeText(url);markShared();setNotice('Profile link copied.')}catch{setNotice('Select and copy the link above.')}
  }
  function download(){
    const link=document.createElement('a')
    link.href=canvas.current.toDataURL('image/png')
    link.download='tapio-profile-qr.png'
    link.click()
    markShared()
  }
  async function share(){try{if(navigator.share){await navigator.share({title:'tap.io profile',url});markShared()}else await copy()}catch(error){if(error.name!=='AbortError')await copy()}}
  return <Dialog title={title} close={close}><QRCodeCanvas ref={canvas} value={url} size={208} marginSize={4} className="qr-code" aria-label="Profile QR code"/><p className="profile-share-url">{url.replace(/^https?:\/\//,'')}</p><div className="actions"><Button onClick={copy}>Copy Link</Button><Button kind="secondary" onClick={download}>Download QR</Button><Button kind="secondary" onClick={share}>Share</Button></div>{children}</Dialog>
}
