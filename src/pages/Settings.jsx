import { useEffect, useState } from 'react'
import { db } from '../services/db'
import { useToast } from '../components/Toast'

export default function Settings(){
 const props=useState(null)[0]
 const [data,setData]=useState({name:'',address:'',phone:''}), [id,setId]=useState(null)
 const toast=useToast()
 useEffect(()=>{db.properties.list().then(x=>{if(x[0]){setId(x[0].id);setData({name:x[0].name||'',address:x[0].address||'',phone:x[0].phone||''})}}).catch(e=>toast.error(e.message))},[])
 const save=async e=>{e.preventDefault();try{if(id) await db.properties.update(id,data); else {const x=await db.properties.create(data);setId(x.id)}toast.success('Property settings saved')}catch(e){toast.error(e.message)}}
 return <div><div className="page-head"><div><h1>Settings</h1><p>Configure the property information used across the application.</p></div></div><section className="panel settings"><h2>Property</h2><form className="form-grid" onSubmit={save}><label>Property name<input required value={data.name} onChange={e=>setData({...data,name:e.target.value})}/></label><label>Contact number<input value={data.phone} onChange={e=>setData({...data,phone:e.target.value})}/></label><label className="full-span">Address<input value={data.address} onChange={e=>setData({...data,address:e.target.value})}/></label><div className="form-actions full-span"><button className="primary">Save settings</button></div></form></section><section className="panel"><h2>Important business rules</h2><ul className="rules"><li>Move-in date and payment due day are separate.</li><li>Rent is stored on each tenancy, preserving historical rates.</li><li>Transfers end the old tenancy and create a new one.</li><li>Historical tenants do not need an active unit.</li><li>Financial records are never overwritten just because a unit's current rent changes.</li></ul></section></div>
}
