"use client";
import { Copy,MoreHorizontal,Pencil,Trash2 } from "lucide-react";
import { useEffect,useRef,useState } from "react";
export function RowMenu({ onEdit,onDelete,onDuplicate }: { onEdit:()=>void; onDelete:()=>void; onDuplicate?:()=>void }) {
  const [open,setOpen]=useState(false); const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false);};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
  return <div ref={ref} style={{position:"relative"}}><button className="icon-button" aria-label="Options" onClick={(event)=>{event.stopPropagation();setOpen((value)=>!value);}}><MoreHorizontal size={19}/></button>{open&&<div className="card row-menu-popover"><button className="list-row" onClick={()=>{setOpen(false);onEdit();}}><Pencil size={17} className="accent"/> Modifier</button>{onDuplicate?<button className="list-row" onClick={()=>{setOpen(false);onDuplicate();}}><Copy size={17} className="accent"/> Dupliquer</button>:null}<button className="list-row negative" onClick={()=>{setOpen(false);onDelete();}}><Trash2 size={17}/> Supprimer</button></div>}</div>;
}
