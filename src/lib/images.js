export async function compressImage(file){
  if(!file||!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
  if(file.size>20_000_000)throw new Error('Choose an image under 20 MB.')
  const url=URL.createObjectURL(file)
  try{
    const image=new Image()
    image.src=url
    await image.decode()
    const scale=Math.min(1,800/Math.max(image.width,image.height))
    const canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round(image.width*scale))
    canvas.height=Math.max(1,Math.round(image.height*scale))
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height)
    return canvas.toDataURL('image/webp',.8)
  }finally{URL.revokeObjectURL(url)}
}
