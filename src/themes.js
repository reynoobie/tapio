export const themes=[
 {name:'Clean',color:'#f1f2f7',text:'#1b1d2a',accent:'#5267e8',card:'#ffffff'},
 {name:'Studio',color:'#21232d',text:'#f8f8fb',accent:'#9faafa',card:'#30333e'},
 {name:'Sand',color:'#f6efe5',text:'#34291c',accent:'#846243',card:'#fffcf6'},
 {name:'Lagoon',color:'#dff0ef',text:'#153332',accent:'#2c7774',card:'#f7ffff'},
 {name:'Orchid',color:'#f2eafa',text:'#322044',accent:'#7c50a5',card:'#fefaff'},
 {name:'Forest',color:'#e8efe7',text:'#203327',accent:'#417052',card:'#f8fff9'},
 {name:'Signal',color:'#fef2d2',text:'#382e1a',accent:'#95601d',card:'#fffaf0'},
 {name:'Slate',color:'#e8edf4',text:'#202c42',accent:'#45628b',card:'#f8fbff'},
]
export function applyTheme(template){
 const {color,text,accent,card}=template
 const border='#'+[1,3,5].map(i=>Math.round(parseInt(card.slice(i,i+2),16)*.72+parseInt(text.slice(i,i+2),16)*.28).toString(16).padStart(2,'0')).join('')
 return {theme:'Custom',background:'Solid',color,text,accent,card,button:accent,border}
}
function luminance(hex){
 const color=/^#[\da-f]{6}$/i.test(hex)?hex:'#ffffff'
 return [1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0)
}
export function contrast(a,b){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05)}
export const readableInk=background=>contrast('#111111',background)>contrast('#ffffff',background)?'#111111':'#ffffff'
