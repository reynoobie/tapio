import {createContext,useContext,useState} from 'react'
import {Moon,Sun} from 'lucide-react'

const ThemeContext=createContext(null)

export function SiteTheme({children}){
  const [theme,setTheme]=useState(()=>{
    try{return localStorage.getItem('tapio.landing.theme')==='dark'?'dark':'light'}catch{return 'light'}
  })
  function toggleTheme(){
    const next=theme==='dark'?'light':'dark'
    setTheme(next)
    try{localStorage.setItem('tapio.landing.theme',next)}catch{}
  }
  return <ThemeContext.Provider value={{theme,toggleTheme}}><div className={theme==='dark'?'site-shell landing-dark':'site-shell'}>{children}</div></ThemeContext.Provider>
}

export const useSiteTheme=()=>useContext(ThemeContext)

export function ThemeToggle(){
  const {theme,toggleTheme}=useSiteTheme()
  const label=theme==='dark'?'Switch to light mode':'Switch to dark mode'
  return <button type="button" className="icon theme-toggle" onClick={toggleTheme} aria-label={label} title={label}>{theme==='dark'?<Sun size={20}/>:<Moon size={20}/>}</button>
}
