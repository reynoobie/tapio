import {useCallback,useEffect,useRef,useState} from 'react'
import {useParams,useSearchParams} from 'react-router-dom'
import {UserRound,Layers,Link2,Palette,LayoutGrid,Settings,PenLine,Ellipsis,ArrowDown,ArrowUp,Eye,EyeOff,Monitor,Plus,Redo2,Undo2,Copy,Smartphone,Trash2} from 'lucide-react'
import {fields,labels,modes,safeLink,sections} from './data'
import {useStore} from './store'
import ImageField from './components/ImageField'
import {normalizeUrl} from './lib/links'
import {applyTheme,contrast,readableInk,themes} from './themes'
import {ShareProfile} from './share'
import {SortBlocks,SortBlock} from './block-sort'
import {profileService} from './services/firebase'
import {SocialIcon} from './social-icons'
import {Button,Dialog,Field,pretty} from './ui'

import {ProfileView} from './public-profile'
const platforms=['LinkedIn','Instagram','GitHub','Facebook','X','TikTok','YouTube','Website','Custom','Spotify','Discord']
const tabs=['Profile','Sections','Links','Theme','Layout','Settings']
const tabIcons={Profile:UserRound,Sections:Layers,Links:Link2,Theme:Palette,Layout:LayoutGrid,Settings}
function LinkEditor({title,items,change}){
  const [expanded,setExpanded]=useState(null)
  const [customLabel,setCustomLabel]=useState(false)
  const social=title==='Social links'
  function patch(index,values){change(items.map((item,i)=>i===index?{...item,...values}:item))}
  function open(index,item){setExpanded(index);setCustomLabel(Boolean(item.label&&item.label!==item.platform))}
  return <section className="compact-link-group"><h3>{title}</h3>
    {items.map((item,i)=><div className="link-editor" key={i}>
      <div className="compact-link-row"><SocialIcon link={item}/><div><strong>{item.label||item.platform||'New link'}</strong><small title={item.url}>{item.url||'Add a destination'}</small></div>
        <button className="icon" type="button" aria-label={'Edit link '+(i+1)} aria-expanded={expanded===i} onClick={()=>expanded===i?setExpanded(null):open(i,item)}><PenLine size={16}/></button>
        <button className="icon" type="button" aria-label={'Delete link '+(i+1)} onClick={()=>{change(items.filter((_,index)=>index!==i));setExpanded(null)}}><Trash2 size={16}/></button>
      </div>
      {expanded===i&&<div className="link-edit-fields">
        {social&&<div className="platform-picker" role="group" aria-label="Platform">{platforms.map(platform=><button type="button" className="platform-choice" key={platform} aria-pressed={(item.platform||(platforms.includes(item.label)?item.label:'Custom'))===platform} onClick={()=>patch(i,{platform,label:customLabel?item.label:platform})}><SocialIcon link={{platform}} size={17}/>{platform}</button>)}</div>}
        {social&&<label><input type="checkbox" checked={customLabel} onChange={event=>{setCustomLabel(event.target.checked);if(!event.target.checked)patch(i,{label:item.platform||'Custom'})}}/> Customize label</label>}
        {(!social||customLabel)&&<Field label="Label" value={item.label} onChange={label=>patch(i,{label})}/>}
        <Field label="Username or URL" placeholder={social?'@username or https://example.com':'https://example.com'} value={item.url} onChange={url=>patch(i,{url})} onBlur={event=>patch(i,{url:normalizeUrl(event.target.value,social?(item.platform||item.label):'Custom')})}/>
        {item.url&&!safeLink(item.url)&&<small className="error">Enter a valid link.</small>}
        <Button kind="secondary" onClick={()=>setExpanded(null)}>Done</Button>
      </div>}
    </div>)}
    <Button kind="secondary" onClick={()=>{change([...items,{label:social?'Custom':'',url:'',...(social?{platform:'Custom'}:{})}]);setExpanded(items.length);setCustomLabel(false)}}><Plus size={16}/> Add {social?'link':'button'}</Button>
  </section>
}

function AccentHex({color,onCommit}){
  const [value,setValue]=useState(color)
  const normalized='#'+value.trim().replace(/^#/,'')
  const valid=/^#[0-9a-f]{6}$/i.test(normalized)
  function commit(){if(valid&&normalized!==color)onCommit(normalized)}
  return <div><Field label="Accent hex" value={value} maxLength={7} onChange={setValue} onBlur={commit}/>{!valid&&<small className="error">Use six hex digits, such as #5267E8.</small>}</div>
}

function BuilderSwitch({label,description,checked,onChange}){
  return <label className="builder-switch"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" role="switch" checked={checked} onChange={event=>onChange(event.target.checked)}/></label>
}

export function Builder({demo=false}){
  const {state,update,setNotice}=useStore()
  const {mode:routeMode}=useParams()
  const [mode,setMode]=useState(modes.find(value=>value.toLowerCase()===routeMode)||(demo?'Personal':state.active))
  const [working,setWorking]=useState(()=>structuredClone(demo?state.demo:state.drafts))
  const [query]=useSearchParams()
  const [tab,setTab]=useState(()=>tabs.includes(query.get('tab'))?query.get('tab'):'Profile')
  const [device,setDevice]=useState('Mobile')
  const [dialog,setDialog]=useState('')
  const [selectedBlock,setSelectedBlock]=useState(null)
  const [status,setStatus]=useState(demo?'Autosaved on this device':'Saved')
  const [zoom,setZoom]=useState('100%')
  const [addOpen,setAddOpen]=useState(false)
  const [undoMessage,setUndoMessage]=useState('')
  const editor=useRef(null)
  const stage=useRef(null)
  const viewport=useRef(null)
  const commandBar=useRef(null)
  const focusTarget=useRef(null)
  const pending=useRef(null)
  const past=useRef([])
  const future=useRef([])
  useEffect(()=>{
    if(['Profile','Links'].includes(query.get('tab'))&&matchMedia('(max-width:1100px)').matches)setDialog('edit')
  },[query])
  useEffect(()=>{
    function fit(){
      if(!stage.current||!viewport.current||!commandBar.current)return
      const topOffset=viewport.current.offsetTop
      const stickyTop=64+commandBar.current.offsetHeight+12
      stage.current.style.setProperty('--builder-preview-top',stickyTop+'px')
      stage.current.style.setProperty('--builder-preview-height',(window.innerHeight-stickyTop-topOffset-28)+'px')
    }
    const observer=new ResizeObserver(fit)
    observer.observe(commandBar.current)
    observer.observe(stage.current.firstElementChild)
    window.addEventListener('resize',fit)
    fit()
    return ()=>{observer.disconnect();window.removeEventListener('resize',fit)}
  },[])
  const p=working[mode]
  const set=change=>{
    setUndoMessage('')
    past.current=[...past.current.slice(-49),working]
    future.current=[]
    setStatus('Saving…')
    setWorking({...working,[mode]:{...p,...change}})
  }
  const history=useCallback(direction=>{
    setUndoMessage('')
    const [source,target]=direction==='undo'?[past,future]:[future,past]
    if(!source.current.length)return
    target.current.push(working)
    setStatus('Saving…')
    setWorking(source.current.pop())
  },[working])
  useEffect(()=>{
    if(status!=='Saving…')return
    pending.current=working
    let cancelled=false
    const timeout=setTimeout(async()=>{const saved=await update(demo?{demo:working}:{drafts:working});if(!cancelled){pending.current=null;setStatus(saved?(demo?'Autosaved on this device':'Saved'):'Not saved — retry Save Draft')}},700)
    return ()=>{cancelled=true;clearTimeout(timeout)}
  },[working,status,demo,update])
  useEffect(()=>()=>{if(pending.current)update(demo?{demo:pending.current}:{drafts:pending.current})},[demo,update])
  useEffect(()=>{
    function key(event){
      if(!(event.metaKey||event.ctrlKey)||event.key.toLowerCase()!=='z'||event.target.closest('input,textarea,[contenteditable]'))return
      event.preventDefault();history(event.shiftKey?'redo':'undo')
    }
    window.addEventListener('keydown',key)
    return ()=>window.removeEventListener('keydown',key)
  },[history])
  async function save(){
    if(!await update(demo?{demo:working}:{drafts:working})){setStatus('Not saved — retry Save Draft');return}
    pending.current=null
    setStatus(demo?'Autosaved on this device':'Saved')
    if(demo)setDialog('account');else setNotice('Draft saved.')
  }
  function requestPublish(){
    if(demo){save();return}
    setDialog('check')
  }
  const invalid=[...p.links,...p.buttons,...p.sections,{url:p.website}].some(item=>item.url&&!safeLink(item.url))
  const hasLink=p.sections.some(section=>!section.hidden&&(safeLink(section.url)||(section.type==='Social Links'&&p.links.some(item=>safeLink(item.url)))||(section.type==='Link Buttons'&&p.buttons.some(item=>safeLink(item.url)))||(section.type==='Contact Information'&&p.website&&(!p.privacy?.website||p.privacy.website==='Public')&&safeLink(p.website))))
  async function publish(){
    if(!p.name.trim()||invalid||!hasLink)return
    try{
    const published=await profileService.publish(p)
    if(!await update({drafts:working,published:{...state.published,[mode]:published}}))return
    pending.current=null
    setStatus(demo?'Autosaved on this device':'Saved');setDialog('published')
    }catch(error){setNotice(error.message)}
  }
  function move(from,to){
    if(from<0||from===to||to<0||to>=p.sections.length)return
    const ordered=[...p.sections];ordered.splice(to,0,...ordered.splice(from,1));set({sections:ordered})
    setUndoMessage('Section moved.')
  }
  function editSection(index,change){set({sections:p.sections.map((item,i)=>i===index?{...item,...change}:item)})}
  function addSection(type){if(type!=='Select a section')set({sections:[...p.sections,{id:crypto.randomUUID(),type,body:'',hidden:false}]})}
  useEffect(()=>{
    if(!undoMessage)return
    const timeout=setTimeout(()=>setUndoMessage(''),4500)
    return ()=>clearTimeout(timeout)
  },[undoMessage])
  function removeSection(index){
    set({sections:p.sections.filter((_,i)=>i!==index)})
    setUndoMessage('Section deleted.')
  }
  useEffect(()=>{
    if(!focusTarget.current)return
    editor.current?.querySelector(focusTarget.current)?.focus()
    focusTarget.current=null
  },[tab,dialog,selectedBlock])
  function selectTab(value){
    setSelectedBlock(null)
    setTab(value)
    if(matchMedia('(max-width:1100px)').matches)setDialog('edit')
  }
  function editPreviewBlock(type,index,key){
    if(key){focusTarget.current='[name='+key+']';selectTab('Profile');requestAnimationFrame(()=>editor.current?.querySelector('[name='+key+']')?.focus());return}
    focusTarget.current=type==='Contact Information'?'[name=email]':type==='Social Links'?'.compact-link-group:first-child button':type==='Link Buttons'?'.compact-link-group:last-child button':'.editor-section[open] textarea'
    const nextTab=['Social Links','Link Buttons'].includes(type)?'Links':type==='Contact Information'?'Profile':'Sections'
    setSelectedBlock(nextTab==='Sections'?{id:p.sections[index].id,version:Date.now()+Math.random()}:null)
    setTab(nextTab)
    if(matchMedia('(max-width:1100px)').matches)setDialog('edit')
  }
  const control=(key,options,type)=> <Field key={key} name={key} maxLength={key==='bio'?160:undefined} rows={key==='bio'?5:undefined} onBlur={key==='website'?event=>set({website:normalizeUrl(event.target.value)}):undefined} label={labels[key]||pretty(key)} value={p[key]} onChange={value=>set(key==='accent'?{accent:value,button:value}:['color','text','card','border'].includes(key)?{[key]:value,theme:'Custom'}:{[key]:value})} options={options} type={type} placeholder={key==='username'?'yourname':undefined}/>
  const warnings=p.theme==='Custom'&&(contrast(p.text,p.color)<4.5||contrast(p.text,p.card)<4.5)
  const panels={
    Profile:<>
      <div className="builder-photo-fields">
        <div className="builder-avatar-field"><ImageField label="Profile photo" value={p.avatar} onChange={avatar=>set({avatar})}/></div>
        <div className="builder-cover-field"><ImageField label="Cover photo" value={p.cover} onChange={cover=>set({cover})}/></div>
      </div>
      {fields[mode].filter(key=>!['email','phone','website'].includes(key)).map(key=>control(key,undefined,key==='bio'?'textarea':undefined))}
      <small className="builder-hint">{(p.bio||'').length}/160 characters</small>
      {mode==='Professional'&&<fieldset className="builder-contact-group"><legend>Contact details</legend>
        {control('email',undefined,'email')}{p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)&&<small className="error">Enter an email like alex@example.com.</small>}
        {control('phone',undefined,'tel')}{p.phone&&!/^\+?[\d ()-]{7,22}$/.test(p.phone)&&<small className="error">Enter a valid phone number.</small>}
        {control('website')}{p.website&&!safeLink(p.website)&&<small className="error">Enter a valid website URL.</small>}
      </fieldset>}
    </>,
    Sections:<>
      <div className="section-picker-anchor" onKeyDown={event=>{if(event.key==='Escape')setAddOpen(false)}}><Button kind="secondary" onClick={()=>setAddOpen(!addOpen)} aria-expanded={addOpen}><Plus size={17}/> Add section</Button>
      {addOpen&&<div className="section-picker">{sections.map(type=><Button key={type} kind="secondary" onClick={()=>{addSection(type);setAddOpen(false)}}>{type}</Button>)}</div>}</div>
      <SortBlocks ids={p.sections.map(s=>s.id)} move={move}>{p.sections.map((s,i)=><SortBlock key={s.id} id={s.id} title={s.type}>
        <details key={selectedBlock?.id===s.id?selectedBlock.version:'block'} className="editor-section" open={selectedBlock?.id===s.id?true:undefined}>
          <summary>{s.type}{s.hidden?' (hidden)':''}</summary>
          <div className="section-actions"><button type="button" className="icon" aria-label={'Move '+s.type+' up'} disabled={!i} onClick={()=>move(i,i-1)}><ArrowUp size={16}/></button><button type="button" className="icon" aria-label={'Move '+s.type+' down'} disabled={i===p.sections.length-1} onClick={()=>move(i,i+1)}><ArrowDown size={16}/></button></div>
          {!['Social Links','Link Buttons','Contact Information'].includes(s.type)&&<><Field label="Description" type="textarea" value={s.body} onChange={value=>editSection(i,{body:value})}/><Field onBlur={event=>editSection(i,{url:normalizeUrl(event.target.value)})} label="Optional URL" value={s.url} onChange={value=>editSection(i,{url:value})}/><Field label="Link label" value={s.linkLabel} onChange={value=>editSection(i,{linkLabel:value})}/>{s.type==='Gallery'&&<ImageField label="Gallery image" value={s.image} onChange={value=>editSection(i,{image:value})}/>}</>}
        </details>
        <div className="section-row-tools">
          <button type="button" className="icon" aria-label={(s.hidden?'Show ':'Hide ')+s.type} onClick={()=>editSection(i,{hidden:!s.hidden})}>{s.hidden?<EyeOff size={16}/>:<Eye size={16}/>}</button>
          <details className="section-more"><summary className="icon" aria-label={'Actions for '+s.type}><Ellipsis size={18}/></summary>
            <Button kind="secondary" onClick={event=>{event.currentTarget.closest('details').open=false;set({sections:[...p.sections.slice(0,i+1),{...s,id:crypto.randomUUID()},...p.sections.slice(i+1)]})}}>Duplicate</Button>
            <Button kind="secondary" onClick={()=>removeSection(i)}>Delete</Button>
          </details>
        </div>
      </SortBlock>)}</SortBlocks>
    </>,
    Links:<><LinkEditor title="Social links" items={p.links} change={links=>set({links,sections:p.sections.some(s=>s.type==='Social Links')?p.sections:[...p.sections,{id:crypto.randomUUID(),type:'Social Links',hidden:false}]})}/><LinkEditor title="Custom buttons" items={p.buttons} change={buttons=>set({buttons,sections:p.sections.some(s=>s.type==='Link Buttons')?p.sections:[...p.sections,{id:crypto.randomUUID(),type:'Link Buttons',hidden:false}]})}/></>,
    Theme:<>
      <div className="editor-presets">{themes.map(theme=><button key={theme.name} type="button" aria-pressed={p.color===theme.color&&p.accent===theme.accent} onClick={()=>set(applyTheme(theme))}><span className="preset-thumb" style={{background:theme.color}}><i style={{background:theme.card}}/><i style={{background:theme.accent}}/></span>{theme.name}</button>)}</div>
      <h3>Customize</h3>
      <div className="builder-accent">{control('accent',undefined,'color')}<AccentHex key={mode+p.accent} color={p.accent} onCommit={accent=>set({accent,button:accent})}/></div>
      {control('font',['Inter','Plus Jakarta Sans','Poppins'])}{control('background',['Solid','Gradient','Uploaded image'])}
      {p.background==='Uploaded image'&&<ImageField label="Background image" value={p.backgroundImage} onChange={value=>set({backgroundImage:value})}/>}
      <details><summary>More colors and shapes</summary><fieldset className="builder-appearance"><legend>Appearance</legend>{['Light','Dark','Custom'].map(theme=><Button key={theme} kind="secondary" aria-pressed={p.theme===theme} onClick={()=>set({theme})}>{theme}</Button>)}</fieldset><div className="color-grid">{['color','text','card','border','button'].map(key=>control(key,undefined,'color'))}</div>{control('shape',['Pill','Rounded rectangle','Square'])}</details>
      {warnings&&<div className="builder-banner">Text contrast is below AA. <button onClick={()=>{const ink=readableInk(p.color);set({text:ink,card:contrast(ink,p.card)>=4.5?p.card:p.color,theme:'Custom'})}}>Fix contrast</button></div>}
    </>,
    Layout:<div className="layout-picker">{['Bento Grid','Stack','Centered','Compact'].map(layout=><button type="button" key={layout} aria-pressed={(p.layout==='Classic List'?'Stack':p.layout)===layout} onClick={()=>set({layout})}><span className={'layout-thumb '+layout.toLowerCase().split(' ')[0]}><i/><i/><i/></span>{layout}</button>)}</div>,
    Settings:<>
      {mode==='Professional'&&<>{['email','phone','website'].map(key=><Field key={key} label={pretty(key)+' visibility'} value={p.privacy?.[key]||'Public'} options={p.privacy?.[key]==='Request access'?['Public','Hidden','Request access']:['Public','Hidden']} onChange={value=>set({privacy:{...p.privacy,[key]:value}})}/>)}<BuilderSwitch label="Let visitors share their contact" description="Visitors can send their contact details from your profile." checked={!!p.contactBack} onChange={contactBack=>set({contactBack})}/></>}
      <BuilderSwitch label="Unlisted profile" description="Ask search engines to leave your profile out of their results." checked={!!p.unlisted} onChange={unlisted=>set({unlisted})}/>
      {!demo&&state.published[mode]&&<section className="builder-danger"><h3>Danger zone</h3><Button kind="secondary" onClick={()=>setDialog('restore')}>Restore Last Published</Button></section>}
    </>,

  }
  const historyButtons=<><button className="icon" aria-label="Undo" title="Undo" disabled={!past.current.length} onClick={()=>history('undo')}><Undo2 size={18}/></button><button className="icon" aria-label="Redo" title="Redo" disabled={!future.current.length} onClick={()=>history('redo')}><Redo2 size={18}/></button></>
  const undoToast=undoMessage&&<div className="builder-undo-toast"><span role="status">{undoMessage}</span><button type="button" onClick={()=>history('undo')}>Undo</button></div>
  const tabButtons=tabs.map(name=>{const Icon=tabIcons[name];return <button type="button" key={name} aria-pressed={tab===name} onClick={()=>selectTab(name)}><Icon size={18} aria-hidden="true"/><span>{name}</span></button>})
  const hint=!p.name.trim()?'Add your display name.':mode==='Professional'&&!p.phone?'Add a phone number to finish your profile.':!p.bio?'Add a short bio.':!p.links.some(link=>safeLink(link.url))?'Add your first link.':'Your profile basics are complete.'
  const progress=[p.name.trim(),p.bio,p.links.some(link=>safeLink(link.url)),...(mode==='Professional'?[p.phone]:[])].filter(Boolean).length
  return <main className={demo?'shell builder-shell polished-builder':'builder-shell polished-builder'}>
    <h1>{demo?'Try tap.io Builder':'Profile Builder'}</h1>
    <div className="builder-command-bar" ref={commandBar}>
      <Field label="Profile mode" value={mode} options={modes} onChange={setMode}/>
      <div className="builder-actions">{historyButtons}<div className="builder-save"><Button kind="secondary" onClick={save}>Save Draft</Button><small role="status">{status}</small></div><Button kind="secondary" onClick={()=>setDialog('preview')}>Preview</Button><Button id="publish-profile" onClick={requestPublish}>Publish</Button></div>
    </div>
    <div className="builder-completeness"><progress aria-label="Profile completeness" value={progress} max={mode==='Professional'?4:3}/><small>{hint}</small></div>
    {demo&&<p className="builder-banner">Try the builder. Create an account to save and publish your profile.</p>}
    <div className="builder-grid">
      <nav className="builder-nav" aria-label="Editor tabs">{tabButtons}</nav>
      <div className="preview-stage" ref={stage}>
        <div className="preview-toolbar"><span>Live preview</span>
          <button className="icon" aria-label="Phone preview" aria-pressed={device==='Mobile'} onClick={()=>setDevice('Mobile')}><Smartphone size={17}/></button>
          <button className="icon" aria-label="Desktop preview" aria-pressed={device==='Desktop'} onClick={()=>setDevice('Desktop')}><Monitor size={17}/></button>
          <select className="builder-zoom" aria-label="Zoom" value={zoom} onChange={event=>setZoom(event.target.value)}>{['75%','90%','100%'].map(value=><option key={value}>{value}</option>)}</select>
          <Button kind="secondary" className="builder-mobile-edit" onClick={()=>setDialog('edit')}>Edit</Button>
        </div>
        <div ref={viewport} className={'preview-device '+device.toLowerCase()} style={{'--preview-zoom':Number.parseInt(zoom,10)/100}}><ProfileView profile={p} mode={mode} onEdit={editPreviewBlock}/></div>
      </div>
      <aside className="editor-panel" ref={dialog==='edit'?null:editor}><h2>{tab}</h2>{dialog!=='edit'&&panels[tab]}</aside>
    </div>
    {!dialog&&undoToast}
    <nav className="builder-phone-tabs" aria-label="Builder tabs">{tabButtons}</nav>
    {dialog==='edit'&&<Dialog title={tab} className="editor-sheet builder-sheet" close={()=>setDialog('')}><div className="editor-sheet-tabs">{tabButtons}</div><div ref={editor}>{panels[tab]}</div>{undoToast}</Dialog>}
    {dialog==='preview'&&<Dialog title={mode+' draft preview'} className="builder-full-preview" close={()=>setDialog('')}><ProfileView profile={p} mode={mode}/></Dialog>}
    {dialog==='account'&&<Dialog title="Save your profile" close={()=>setDialog('')}><p>Create a tap.io account to keep your design and publish your profile.</p><div className="actions"><Button to="/register?import=1">Create Account</Button><Button kind="secondary" onClick={()=>setDialog('')}>Continue Editing</Button></div></Dialog>}
    {dialog==='check'&&<Dialog title="Ready to go live?" close={()=>setDialog('')}><ul className="publish-check"><li>{p.name.trim()?'Ready':'Needed'} · Display name</li><li>{hasLink&&!invalid?'Ready':'Needed'} · At least one visible link and valid URLs</li><li>{p.avatar?'Ready':'Optional'} · Profile photo</li></ul><Button onClick={publish} disabled={!p.name.trim()||!hasLink||invalid}>Go Live</Button></Dialog>}
    {dialog==='published'&&<ShareProfile title={mode+' profile published'} path={'/p/'+state.account.username} close={()=>setDialog('')}><p>{state.active===mode?'This profile is active.':'Open My Profiles to make this mode active.'}</p><div className="actions"><Button to="/app/profiles" kind="secondary">My Profiles</Button>{!state.cards.some(card=>card.owner===state.account.username&&card.status==='Claimed')&&<Button to="/app/cards">Claim Your Card</Button>}</div></ShareProfile>}
    {dialog==='restore'&&<Dialog title="Restore the last published version?" close={()=>setDialog('')}><p>This replaces the current draft. You can undo it in the editor.</p><Button onClick={()=>{set(structuredClone(state.published[mode]));setDialog('')}}>Restore Draft</Button></Dialog>}
  </main>
}
