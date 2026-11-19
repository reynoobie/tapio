const socialUrls={
  LinkedIn:'https://www.linkedin.com/in/',
  GitHub:'https://github.com/',
  Instagram:'https://www.instagram.com/',
  TikTok:'https://www.tiktok.com/@',
  X:'https://x.com/',
  Facebook:'https://www.facebook.com/',
  YouTube:'https://www.youtube.com/@',
}

export function normalizeUrl(value,platform){
  const url=value.trim()
  if(!url)return ''
  if(socialUrls[platform]&&/^(?:@[\w.-]+|[\w-]+)$/.test(url))return socialUrls[platform]+url.replace(/^@/,'')
  if(url.startsWith('//'))return 'https:'+url
  return /^[a-z][a-z\d+.-]*:/i.test(url)||url.startsWith('@')?url:'https://'+url
}
