import {Globe,Link2} from 'lucide-react'
import {siFacebook,siInstagram,siTiktok,siYoutube,siSpotify,siDiscord,siGithub,siX} from 'simple-icons'

const platforms={
  facebook:{icon:siFacebook,domains:['facebook.com','fb.com','fb.me']},
  instagram:{icon:siInstagram,domains:['instagram.com']},
  tiktok:{icon:siTiktok,domains:['tiktok.com']},
  youtube:{icon:siYoutube,domains:['youtube.com','youtu.be']},
  spotify:{icon:siSpotify,domains:['spotify.com']},
  discord:{icon:siDiscord,domains:['discord.com','discord.gg']},
  x:{icon:siX,domains:['x.com','twitter.com']},
  github:{icon:siGithub,domains:['github.com']},
  linkedin:{icon:null,domains:['linkedin.com']},
}

function platformFor(link){
  const selected=(link.platform||'').trim().toLowerCase()
  if(platforms[selected])return platforms[selected]
  try{
    const host=new URL(link.url).hostname.toLowerCase()
    const match=Object.values(platforms).find(platform=>platform.domains.some(domain=>host===domain||host.endsWith('.'+domain)))
    if(match)return match
  }catch{}
  return platforms[(link.label||'').trim().toLowerCase()]
}

export function SocialIcon({link,size=18}){
  if(link.platform==='Website')return <Globe size={size} aria-hidden="true"/>
  const platform=platformFor(link)
  if(!platform)return <Link2 size={size} aria-hidden="true"/>
  if(!platform.icon)return <span className="linkedin-icon" aria-hidden="true" data-platform="LinkedIn"><span>in</span></span>
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" data-platform={platform.icon.title}><path d={platform.icon.path}/></svg>
}
