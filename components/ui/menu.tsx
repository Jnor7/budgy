"use client";
import { MoreHorizontal,Pencil,Trash2 } from "lucide-react";
import { useEffect,useRef,useState } from "react";
export function RowMenu({ onEdit,onDelete }: { onEdit:()=>void; onDelete:()=>void }) {
  const [open,setOpen]=useState(false); const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false);};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
  return <div ref={ref} style={{position:"relative"}}><button className="icon-button" aria-label="Options" onClick={(event)=>{event.stopPropagation();setOpen((value)=>!value);}}><MoreHorizontal size={19}/></button>{open&&<div className="card stack-sm" style={{position:"absolute",right:0,top:45,zIndex:20,minWidth:150,padding:8}}><button className="list-row" onClick={()=>{setOpen(false);onEdit();}}><Pencil size={17} className="accent"/> Modifier</button><button className="list-row negative" onClick={()=>{setOpen(false);onDelete();}}><Trash2 size={17}/> Supprimer</button></div>}</div>;
}
