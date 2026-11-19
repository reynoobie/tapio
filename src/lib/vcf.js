import {safeLink} from '../data'
export function saveContact(profile){
  const escape=value=>String(value||'').replaceAll('\\','\\\\').replace(/\r?\n/g,'\\n').replaceAll(',','\\,').replaceAll(';','\\;')
  const entries={FN:profile.name,ORG:profile.company,TITLE:profile.title,EMAIL:profile.email,TEL:profile.phone,URL:safeLink(profile.website)}
  const text=['BEGIN:VCARD','VERSION:3.0','N:;'+escape(profile.name)+';;;',...Object.entries(entries).filter(([,value])=>value).map(([key,value])=>key+':'+escape(value)),'END:VCARD'].join('\r\n')
  const url=URL.createObjectURL(new Blob([text],{type:'text/vcard'}))
  const link=document.createElement('a');link.href=url;link.download='tapio-contact.vcf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
