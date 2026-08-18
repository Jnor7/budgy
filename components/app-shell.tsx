"use client";
import { Home,BriefcaseBusiness,CircleDollarSign,Plane } from "lucide-react";
import Link from "next/link"; import { usePathname } from "next/navigation";
const tabs=[{href:"/",label:"Accueil",icon:Home},{href:"/business",label:"Business",icon:BriefcaseBusiness},{href:"/budget",label:"Budget",icon:CircleDollarSign},{href:"/trips",label:"Voyages",icon:Plane}];
export function AppShell({children}:{children:React.ReactNode}) { const pathname=usePathname(); return <div className="app-frame">{children}<div className="tabbar-wrap"><nav className="tabbar" aria-label="Navigation principale">{tabs.map(({href,label,icon:Icon})=>{const active=href==="/"?pathname==="/":pathname.startsWith(href);return <Link className={`tab ${active?"active":""}`} href={href} key={href}><Icon size={23} strokeWidth={active?2.7:2.2}/><span>{label}</span><i className="tab-dot"/></Link>;})}</nav></div></div>; }
