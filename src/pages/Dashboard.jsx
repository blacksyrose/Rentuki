import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Building2, CreditCard, DollarSign, Users, Wrench } from 'lucide-react'
import { db } from '../services/db'
import { useAsync } from '../hooks/useData'
import { currentMonth, money } from '../lib/utils'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const units = useAsync(()=>db.units.list(),[])
  const tenants = useAsync(()=>db.tenants.list(),[])
  const billing = useAsync(()=>db.billing.list(currentMonth()),[])
  const maintenance = useAsync(()=>db.maintenance.list(),[])
  const expenses = useAsync(()=>db.expenses.list(),[])
  const us = units.data || [], ts = tenants.data || [], bs = billing.data || [], ms = maintenance.data || [], es = expenses.data || []
  const activeTenants = ts.filter(t=>t.status==='active')
  const occupied = us.filter(u=>u.status==='occupied').length
  const expected = bs.reduce((a,b)=>a+Number(b.amount_due||0),0)
  const collected = bs.reduce((a,b)=>a+(b.payments||[]).reduce((x,p)=>x+Number(p.amount||0),0),0)
  const expensesThis = es.filter(e=>String(e.expense_date||'').startsWith(currentMonth())).reduce((a,b)=>a+Number(b.amount||0),0)
  const overdue = bs.filter(b=>new Date(b.due_date)<new Date() && Number(b.amount_due||0) > (b.payments||[]).reduce((a,p)=>a+Number(p.amount||0),0)).length
  const recent = useMemo(()=>[
    ...bs.flatMap(b=>(b.payments||[]).map(p=>({type:'Payment received',text:`${money(p.amount)} payment`,date:p.payment_date}))),
    ...ms.map(m=>({type:'Maintenance',text:m.title,date:m.reported_date}))
  ].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,7),[bs,ms])
  return <div>
    <div className="page-head"><div><h1>Dashboard</h1><p>Here’s the current picture of your rental operation.</p></div><div className="actions"><Link className="primary" to="/tenants">Add Tenant</Link><Link className="secondary" to="/payments">Record Payment</Link></div></div>
    <div className="stats-grid">
      <StatCard label="Total Units" value={us.length} icon={Building2}/>
      <StatCard label="Occupied" value={occupied} hint={`${us.length?Math.round(occupied/us.length*100):0}% occupancy`} icon={Building2} tone="success"/>
      <StatCard label="Active Tenants" value={activeTenants.length} icon={Users}/>
      <StatCard label="Expected Rent" value={money(expected)} icon={DollarSign}/>
      <StatCard label="Collected" value={money(collected)} icon={CreditCard} tone="success"/>
      <StatCard label="Outstanding" value={money(Math.max(expected-collected,0))} icon={DollarSign} tone="warning"/>
      <StatCard label="Overdue" value={overdue} icon={CreditCard} tone="danger"/>
      <StatCard label="Open Maintenance" value={ms.filter(x=>x.status==='open'||x.status==='in progress').length} icon={Wrench}/>
    </div>
    <div className="two-col">
      <section className="panel"><div className="panel-head"><div><h2>Financial snapshot</h2><p>{currentMonth()}</p></div><Link to="/summary">View summary <ArrowUpRight size={15}/></Link></div>
        <div className="finance-list"><div><span>Expected rent</span><strong>{money(expected)}</strong></div><div><span>Collected</span><strong>{money(collected)}</strong></div><div><span>Outstanding</span><strong>{money(Math.max(expected-collected,0))}</strong></div><div><span>Expenses</span><strong>{money(expensesThis)}</strong></div><div className="total"><span>Net cash result</span><strong>{money(collected-expensesThis)}</strong></div></div>
      </section>
      <section className="panel"><div className="panel-head"><div><h2>Recent activity</h2><p>Latest operational events</p></div></div>
        <div className="activity-list">{recent.length?recent.map((r,i)=><div className="activity" key={i}><span className="dot"/><div><strong>{r.type}</strong><p>{r.text}</p></div><small>{r.date}</small></div>):<div className="empty">No activity yet.</div>}</div>
      </section>
    </div>
  </div>
}
