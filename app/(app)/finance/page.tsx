"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { FinanceCockpit } from "@/features/finance/cockpit";
export default function FinancePage(){return <main className="page page-narrow stack"><div className="spread"><Link className="icon-button" href="/"><ArrowLeft/></Link><strong>Cockpit financier</strong><span/></div><div className="bubble-header"><h1>Mes finances</h1><p>Trésorerie, engagements, provisions et objectifs.</p></div><FinanceCockpit/></main>}
