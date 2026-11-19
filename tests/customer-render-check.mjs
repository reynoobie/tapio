import {createServer} from 'vite'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import assert from 'node:assert/strict'
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',plugins:[{
  name:'customer-fixtures',enforce:'pre',
  resolveId(source){if(source==='./store'||source==='../store')return '\0customer-fixture'},
  load(id){if(id==='\0customer-fixture')return `export const useStore=()=>({state:{customers:[{id:'new-account',account:{name:'Reynaldo',email:'rey@example.com',username:'rey200431',createdAt:'2026-11-19T16:32:39.512Z'},active:'Personal'},{id:'incomplete-account'}]},update:()=>{},setNotice:()=>{}})`},
}]})
try{
 const {Customers}=await server.ssrLoadModule('/src/dashboard.jsx')
 const html=renderToStaticMarkup(createElement(Customers))
 assert.ok(html.includes('Reynaldo'))
 assert.ok(html.includes('rey@example.com'))
 assert.ok(html.includes('Unnamed account'))
 assert.ok(html.includes('2026-11-19'))
 console.log('PASS: Customers renders current-schema and incomplete accounts without legacy published fields')
}finally{await server.close()}
