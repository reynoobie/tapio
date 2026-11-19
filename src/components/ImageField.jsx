import {CloudImage} from './CloudImage'
import {useRef,useState} from 'react'
import {Button} from '../ui'
import {useStore} from '../store'
import {compressImage} from '../lib/images'

export default function ImageField({label,value,onChange,accept='image/png,image/jpeg,image/webp,image/gif'}){
  const input=useRef(null)
  const [busy,setBusy]=useState(false)
  const {setNotice}=useStore()
  async function choose(event){
    const file=event.currentTarget.files?.[0]
    event.currentTarget.value=''
    if(!file)return
    setBusy(true)
    try{await onChange(await compressImage(file))}
    catch(error){setNotice(error.message)}
    finally{setBusy(false)}
  }
  return <div className="image-field">
    <input hidden ref={input} type="file" accept={accept} onChange={choose} aria-label={label}/>
    {value&&<CloudImage className="image-field-preview" src={value} alt={label}/>}
    <div className="actions">
      <Button kind="secondary" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Preparing image…':value?'Replace '+label.toLowerCase():label}</Button>
      {value&&<Button kind="secondary" disabled={busy} onClick={()=>onChange('')}>Remove</Button>}
    </div>
  </div>
}
