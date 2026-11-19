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
    for(let attempt=0;attempt<5;attempt++){
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height)
      for(const quality of [.8,.65,.5]){
        const result=canvas.toDataURL('image/webp',quality)
        if(result.length<=180000)return result
      }
      canvas.width=Math.max(1,Math.round(canvas.width*.75))
      canvas.height=Math.max(1,Math.round(canvas.height*.75))
    }
    throw new Error('This image could not be compressed. Choose a smaller image.')
  }finally{URL.revokeObjectURL(url)}
}
