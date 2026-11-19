import {useState} from 'react'
import {Link} from 'react-router-dom'
import {ArrowRight,RotateCw} from 'lucide-react'
import NfcCard from './NfcCard'
import {BRAND} from './brand'
import '../cards.css'

const cards=[
  {variant:'classic',label:'Classic',name:'Maya Reyes',title:'Product designer',description:'A clean everyday card with an ivory pearl finish.'},
  {variant:'black',label:'Matte Black',name:'Jon Dela Cruz',title:'Founder, Dela Cruz Studio',description:'A low-gloss black finish with a gold foil name.'},
  {variant:'custom',label:'Custom',name:'Your Name',title:'Your title',description:'Personalize the color, name, and logo in the shop.'},
]
export default function CardShowcase(){
  const [flips,setFlips]=useState({})
  const [tilt,setTilt]=useState({})
  function flip(variant){
    setFlips(current=>({...current,[variant]:!current[variant]}))
  }
  function move(event,variant){
    if(event.pointerType==='touch'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
    const box=event.currentTarget.getBoundingClientRect()
    const x=Math.max(-1,Math.min(1,(event.clientX-box.left)/box.width*2-1))
    const y=Math.max(-1,Math.min(1,(event.clientY-box.top)/box.height*2-1))
    setTilt(current=>({...current,[variant]:{x:x*9,y:-y*7}}))
  }
  return <section className="shell section card-showcase" aria-labelledby="card-showcase-heading">
    <div className="card-showcase-header"><div><h2 id="card-showcase-heading">Find your {BRAND}.</h2><p>Your name, your logo, one tap. Pick the finish that feels like you.</p></div><Link to="/shop" className="card-shop-link">Browse cards <ArrowRight size={17} aria-hidden="true"/></Link></div>
    <div className="card-showcase-grid">{cards.map(item=>{
      const flipped=Boolean(flips[item.variant])
      const angle=tilt[item.variant]||{x:0,y:0}
      return <article className="card-showcase-tile" key={item.variant} tabIndex="0" aria-label={item.label+' card. Press Enter or Space to flip.'} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();flip(item.variant)}}}>
        <div className={'card-stage card-stage--'+item.variant} style={{'--rx':angle.x,'--ry':angle.y}} onPointerMove={event=>move(event,item.variant)} onPointerLeave={()=>setTilt(current=>({...current,[item.variant]:{x:0,y:0}}))}>
          <NfcCard {...item} flipped={flipped} onFlip={()=>flip(item.variant)}/>
          <button className="card-flip" type="button" aria-label={'Flip '+item.label+' card'} aria-pressed={flipped} onClick={()=>flip(item.variant)}><RotateCw size={18}/></button>
        </div>
        <div className="card-showcase-copy"><h3>{BRAND} {item.label}</h3><p>{item.description}</p></div>
      </article>
    })}</div>
  </section>
}
