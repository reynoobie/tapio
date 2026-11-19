import {compressImage} from '../lib/images'
import {useStore} from '../store'
const colors=[
  {name:'Midnight',a:'#3f46c4',b:'#1a1d6b'},
  {name:'Emerald',a:'#1f8a6a',b:'#0a4a3a'},
  {name:'Burgundy',a:'#a8324a',b:'#5a1426'},
  {name:'Champagne',a:'#bfa05a',b:'#6e5622'},
]
export const defaultCustomCard={name:'',title:'',logoSrc:'',colorA:colors[0].a,colorB:colors[0].b,flipped:false}

export default function CustomCardEditor({card,onChange}){
  const {setNotice}=useStore()
  function change(values){onChange({...card,...values,flipped:false})}
  async function upload(event){
    const file=event.target.files?.[0]
    event.target.value=''
    if(!file)return
    try{change({logoSrc:await compressImage(file)})}catch(error){setNotice(error.message)}
  }
  const selected=colors.find(color=>color.a===card.colorA&&color.b===card.colorB)
  return <div className="custom-card-editor">
    <label>Name<input aria-label="Name on custom card" maxLength={26} placeholder="Your Name" value={card.name} onChange={event=>change({name:event.target.value})}/></label>
    <label>Title<input aria-label="Title on custom card" maxLength={30} placeholder="Your title" value={card.title} onChange={event=>change({title:event.target.value})}/></label>
    <div className="custom-logo-control"><label className="custom-upload">Add logo<input type="file" accept="image/*" aria-label="Add logo" onChange={upload}/></label>{card.logoSrc&&<button type="button" onClick={()=>change({logoSrc:''})}>Remove logo</button>}</div>
    <fieldset><legend>Card color <span>{selected?.name}</span></legend><div className="custom-swatches">{colors.map(color=><button type="button" key={color.name} aria-label={color.name} aria-pressed={color.name===selected?.name} title={color.name} onClick={()=>change({colorA:color.a,colorB:color.b})} style={{background:'linear-gradient(135deg,'+color.a+','+color.b+')'}}/>)}</div></fieldset>
  </div>
}
