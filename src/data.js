export const modes = ['Personal', 'Professional']
export const sections = ['About','Social Links','Link Buttons','Gallery','Portfolio','Projects','Services','Products','Contact Information','Music','Featured Content','Business Information']
export const fields = {
  Personal: ['name','username','bio','location'],
  Professional: ['name','title','company','bio','email','phone','website','location'],
}
export const labels = {name:'Display name',bio:'Bio',avatar:'Profile photo',cover:'Cover photo',backgroundImage:'Background image'}
export function profile(mode) {
  const professional = mode === 'Professional'
  return {
    name:'Alex Rivera', username:'alex', title:professional ? 'Product Designer' : '', company:professional ? 'Rivera Studio' : '',
    bio:professional ? 'Designing clear, thoughtful digital products.' : 'Photography, music, and weekend trips around Manila.',
    location:'Manila, Philippines', email:professional ? 'alex@example.com' : '', phone:professional ? '+63 917 123 4567' : '', website:'',
    avatar:'', cover:'', backgroundImage:'', theme:'Light', background:'Solid', color:'#f1f0ed', text:'#161619',
    accent:'#5267e8', card:'#ffffff', border:'#dddddf', button:'#5267e8', font:'Inter', shape:'Pill', layout:'Classic List',
    sections:[{type:'About',body:'Based in Manila.',hidden:false},{type:'Social Links',body:'',hidden:false},...(professional?[{type:'Contact Information',body:'',hidden:false},{type:'Portfolio',body:'Product design and interface work.',hidden:false}]:[{type:'Featured Content',body:'Weekend street photography.',hidden:false}])].map((section,index)=>({...section,id:'seed-'+index})),
    links:[{label:professional ? 'LinkedIn' : 'Instagram',url:professional ? 'https://www.linkedin.com/' : 'https://www.instagram.com/'}],
    buttons:[],
  }
}
export function emptyProfile(mode){
  const p=profile(mode)
  return {...p,name:'',username:'',title:'',company:'',bio:'',location:'',email:'',phone:'',links:[],buttons:[],layout:'Stack',sections:p.sections.map(section=>({...section,body:''}))}
}
export const initial = {
  messages:[],messageRead:{},paymentDetails:{number:'',qr:''},session:null,account:{name:'',email:'',username:''},
  active:'Personal',drafts:{Personal:emptyProfile('Personal'),Professional:emptyProfile('Professional')},
  published:{Personal:null,Professional:null},demo:{Personal:profile('Personal'),Professional:profile('Professional')},
  products:[],cards:[],cart:{},cartDesigns:{},orders:[],checklistHidden:false,contactRequests:[],
}
export const money = value => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(value)
export function safeLink(value) {
  try { const url=new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : '' } catch { return '' }
}
export const steps = ['Choose an NFC card','Place an order','Receive your card','Tap it on an NFC-compatible phone','Create an account or sign in','Enter the code included with your card','Claim your card','Customize and publish your profile','Share your profile with a tap']
