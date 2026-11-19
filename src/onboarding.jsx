import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {Button,Field} from './ui'
import {ProfileView} from './public-profile'
import {ShareProfile} from './share'
import {applyTheme,themes} from './themes'
import {publicUrl} from './lib/urls'
import {modes,safeLink} from './data'
import {useStore} from './store'
import ImageField from './components/ImageField'
import {normalizeUrl} from './lib/links'
import {profileService} from './services/firebase'

const templates={Personal:['Clean','Creator','Gamer','Student','Playlist','Minimal Dark'],Professional:['Executive','Freelancer','Business Card','Portfolio','Small Shop','Resume']}
const templateSections={Gamer:['Music','Featured Content'],Resume:['Services','Portfolio'],Playlist:['Music'],Creator:['Gallery','Featured Content'],'Small Shop':['Products','Business Information']}
const templateThemes={Personal:[0,4,1,3,5,7],Professional:[7,2,0,4,6,1]}
export function Onboarding(){
 const {state,update,setNotice}=useStore()
 const navigate=useNavigate()
 const [step,setStep]=useState(0)
 const [mode,setMode]=useState(state.active)
 const [drafts,setDrafts]=useState(()=>structuredClone(state.drafts))
 const [template,setTemplate]=useState(null)
 const [published,setPublished]=useState(false)
 const p=drafts[mode]
 const titles=['Pick a profile mode','Choose a template','Add the basics','Preview your profile']
 const edit=change=>setDrafts(old=>({...old,[mode]:{...old[mode],...change}}))
 const link=p.links[0]||{label:'My link',url:''}
 const second=p.links[1]||{label:'Another link',url:''}
 function setLink(index,url){const links=[...p.links];if(index===1&&!links[0])links[0]=link;links[index]={...(index?second:link),url};edit({links})}
 async function skip(){if(await update({drafts}))navigate('/app')}
 async function publish(){
   if(!p.name.trim()||!p.links.some(item=>safeLink(item.url))||p.links.some(item=>item.url&&!safeLink(item.url)))return
   try{
   const profile=await profileService.publish({...p,sections:p.sections.some(section=>section.type==='Social Links'&&!section.hidden)?p.sections:[...p.sections,{id:crypto.randomUUID(),type:'Social Links',hidden:false}]})
   if(!await update({drafts:{...drafts,[mode]:profile},published:{...state.published,[mode]:profile},active:mode}))return
   setPublished(true)
   }catch(error){setNotice(error.message)}
 }
 return <main className="onboarding"><div className="section-head"><div><p className="eyebrow">STEP {step+1} OF 4</p><h1>{titles[step]}</h1></div><Button kind="secondary" onClick={skip}>Skip for Now</Button></div><progress aria-label="Setup progress" max="4" value={step+1}/>
   {step===0&&<div className="grid-two">{modes.map(value=><button className={'panel onboarding-choice '+(mode===value?'selected':'')} aria-pressed={mode===value} key={value} onClick={()=>{setMode(value);setTemplate(null)}}><h2>{value}</h2><p>{value==='Personal'?'Share your social links, photos, and interests.':'Share your work, business, and contact details.'}</p></button>)}</div>}
   {step===1&&<div className="grid-three">{templates[mode].map((name,i)=>{const theme=themes[templateThemes[mode][i]];return <button className="panel" key={name} aria-pressed={template===name} onClick={()=>{setTemplate(name);edit({...applyTheme(theme),layout:i===3?'Bento Grid':'Classic List',sections:[...p.sections.filter(section=>!section.templateSection||section.body||section.url||section.image),...(templateSections[name]||[]).filter(type=>!p.sections.some(section=>section.type===type&&(!section.templateSection||section.body||section.url||section.image))).map(type=>({id:crypto.randomUUID(),type,templateSection:true,body:'',hidden:false}))]})}}><span className="template-swatch" style={{backgroundColor:theme.color,color:theme.text}}><span style={{backgroundColor:theme.accent}}/> Aa</span><strong>{name}</strong></button>})}</div>}
   {step===2&&<section className="panel"><Field label="Display name" value={p.name} onChange={name=>edit({name})}/>{mode==='Professional'&&<Field label="Professional title" value={p.title} onChange={title=>edit({title})}/>}<Field label="Bio" type="textarea" rows={5} value={p.bio} onChange={bio=>edit({bio})}/><ImageField label="Profile photo" accept="image/*" value={p.avatar} onChange={avatar=>edit({avatar})}/><Field label="First link" onBlur={event=>setLink(0,normalizeUrl(event.target.value))} value={link.url} onChange={url=>setLink(0,url)}/><Field label="Second link (optional)" onBlur={event=>setLink(1,normalizeUrl(event.target.value))} value={second.url} onChange={url=>setLink(1,url)}/></section>}
   {step===3&&<div className="grid-two"><ProfileView profile={p} mode={mode}/><section className="panel"><h2>Your profile link</h2><p>{publicUrl('/p/'+state.account.username).replace(/^https?:\/\//,'')}</p><p>Add a name and at least one valid link to go live.</p><Button disabled={!p.name.trim()||!p.links.some(item=>safeLink(item.url))||p.links.some(item=>item.url&&!safeLink(item.url))} onClick={publish}>Go Live</Button></section></div>}
   <div className="actions onboarding-actions">{step>0&&<Button kind="secondary" onClick={()=>setStep(step-1)}>Back</Button>}{step<3&&<Button onClick={()=>setStep(step+1)}>Continue</Button>}</div>
   {published&&<ShareProfile path={'/p/'+state.account.username} title="Your profile is live" close={()=>navigate('/app')}><div className="actions"><Button to="/app">Go to Dashboard</Button></div></ShareProfile>}
 </main>
}
