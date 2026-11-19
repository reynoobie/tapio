import NfcCard from './NfcCard'

const palettes={
  chalk:{a:'#bfbdb5',b:'#77746e'},
  onyx:{a:'#363640',b:'#111116'},
  cobalt:{a:'#3f46c4',b:'#1a1d6b'},
}

export default function ShopCard({product,design,flipped=false,onFlip}){
  const variant=({chalk:'classic',onyx:'black',cobalt:'custom'})[product.tone]||'custom'
  const palette=palettes[design?.tone||product.tone]||palettes.cobalt
  const name=design?.name||(variant==='classic'?'Maya Reyes':variant==='black'?'Jon Dela Cruz':'Alex Rivera')
  const title=design?.title||(variant==='classic'?'Product designer':variant==='black'?'Founder, Dela Cruz Studio':'Creative director')
  return <div aria-hidden={onFlip?undefined:true} className={'shop-card-preview'+(design?.placement==='Center'?' center-name':'')}>
    <NfcCard variant={variant} name={name} title={title} logoSrc={design?.logoSrc||design?.mark} colorA={design?.colorA||palette.a} colorB={design?.colorB||palette.b} flipped={flipped} onFlip={onFlip}/>
  </div>
}
