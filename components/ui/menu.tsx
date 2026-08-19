"use client";
import { Copy,MoreHorizontal,Pencil,Trash2 } from "lucide-react";
import { useEffect,useRef,useState } from "react";
export function RowMenu({ onEdit,onDelete,onDuplicate }: { onEdit:()=>void; onDelete:()=>void; onDuplicate?:()=>void }) {
  const [open,setOpen]=useState(false); const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false);};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
  return <div ref={ref} className="row-menu"><button className="icon-button" aria-label="Options" aria-expanded={open} onClick={(event)=>{event.preventDefault();event.stopPropagation();setOpen((value)=>!value);}}><MoreHorizontal size={19}/></button>{open&&<div className="card row-menu-popover" role="menu"><button type="button" role="menuitem" onClick={(event)=>{event.preventDefault();event.stopPropagation();setOpen(false);onEdit();}}><Pencil size={16}/> <span>Modifier</span></button>{onDuplicate?<button type="button" role="menuitem" onClick={(event)=>{event.preventDefault();event.stopPropagation();setOpen(false);onDuplicate();}}><Copy size={16}/> <span>Dupliquer</span></button>:null}<button type="button" role="menuitem" className="negative" onClick={(event)=>{event.preventDefault();event.stopPropagation();setOpen(false);onDelete();}}><Trash2 size={16}/> <span>Supprimer</span></button></div>}</div>;
}
