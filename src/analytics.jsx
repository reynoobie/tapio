import {useEffect,useState} from 'react'
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {analyticsService} from './services/firebase'
import {Field} from './ui'
const metrics={'Card taps':'taps','Link clicks':'links','Saved contacts':'contacts'}
export default function Analytics(){
 const [samples,setSamples]=useState(null)
 const [error,setError]=useState('')
 const [metric,setMetric]=useState('Card taps')
 useEffect(()=>{analyticsService.getSample().then(setSamples).catch(error=>setError(error.message))},[])
 return <main><div className="section-head"><div><h1>Analytics</h1><p>Daily unique interactions with your public profile and NFC card.</p></div></div><section className="panel chart-panel"><Field label="Metric" value={metric} options={Object.keys(metrics)} onChange={setMetric}/>{error?<p role="alert">{error}</p>:samples?.length===0?<p>No activity recorded yet.</p>:samples?<><div role="img" aria-label={metric+' activity chart'}><ResponsiveContainer width="100%" height={260}><BarChart data={samples} margin={{left:0,right:8}}><CartesianGrid vertical={false}/><XAxis dataKey="day"/><YAxis width={28} allowDecimals={false}/><Tooltip/><Bar dataKey={metrics[metric]} name={metric} fill="#5267e8" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div><details><summary>Read activity values</summary><ul>{samples.map(row=><li key={row.day}>{row.day} · {row[metrics[metric]]}</li>)}</ul></details></>:<p role="status">Loading activity…</p>}</section></main>
}
