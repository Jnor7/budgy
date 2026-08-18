"use client";

import { Download, Eye, File, FileImage, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/modal";
import { useBudgyData } from "@/lib/data/data-provider";
import { attachmentPreviewUrl, deleteAttachmentFile, uploadAttachmentFile } from "@/services/attachments";
import type { Attachment } from "@/types/domain";

type Parent = { businessId: string; dubaiPartId?: never } | { businessId?: never; dubaiPartId: string };

export function AttachmentManager(parent: Parent) {
  const { data, create, remove, localMode, userId } = useBudgyData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ item:Attachment; url:string }>();
  const items = data.attachments.filter((item) => parent.businessId ? item.businessId===parent.businessId : item.dubaiPartId===parent.dubaiPartId);

  const upload = async (file: File) => {
    setBusy(true); setError("");
    try {
      const storagePath = await uploadAttachmentFile(file, userId, localMode);
      create("attachments", {fileName:file.name,mimeType:file.type||"application/octet-stream",storagePath,sizeBytes:file.size,createdAt:new Date().toISOString(),...parent});
    } catch (reason) { setError(reason instanceof Error?reason.message:"Upload impossible."); }
    finally { setBusy(false); if(inputRef.current) inputRef.current.value=""; }
  };
  const show = async (item: Attachment) => {
    setBusy(true); setError("");
    try { setPreview({item,url:await attachmentPreviewUrl(item.storagePath,localMode)}); }
    catch (reason) { setError(reason instanceof Error?reason.message:"Aperçu impossible."); }
    finally { setBusy(false); }
  };
  const destroy = async (item: Attachment) => {
    setBusy(true); setError("");
    try { await deleteAttachmentFile(item.storagePath,localMode); remove("attachments",item.id); if(preview?.item.id===item.id)setPreview(undefined); }
    catch (reason) { setError(reason instanceof Error?reason.message:"Suppression impossible."); }
    finally { setBusy(false); }
  };

  return <Card><div className="spread"><div><h2 className="section-title">Documents</h2><span className="muted small">Images, PDF et justificatifs</span></div><button className="button button-soft" disabled={busy} onClick={()=>inputRef.current?.click()}><Upload size={17}/>{busy?"Patientez…":"Ajouter"}</button></div>
    <input ref={inputRef} hidden type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={(event)=>{const file=event.target.files?.[0];if(file)void upload(file);}}/>
    {error&&<p className="error">{error}</p>}
    {items.length===0?<div className="empty-inline"><Paperclip className="muted"/><span className="muted small">Aucun document joint.</span></div>:items.map((item)=><div className="list-row" key={item.id}>
      <span className="icon-tile icon-purple">{item.mimeType.startsWith("image/")?<FileImage size={19}/>:item.mimeType==="application/pdf"?<FileText size={19}/>:<File size={19}/>}</span>
      <div className="list-main"><strong>{item.fileName}</strong><span className="muted small">{Math.max(1,Math.round(item.sizeBytes/1024))} Ko</span></div>
      <button className="icon-button" aria-label="Aperçu" onClick={()=>void show(item)}><Eye size={18}/></button>
      <button className="icon-button negative" aria-label="Supprimer" onClick={()=>void destroy(item)}><Trash2 size={18}/></button>
    </div>)}
    <Sheet open={Boolean(preview)} title={preview?.item.fileName??"Aperçu"} onClose={()=>setPreview(undefined)}>{preview&&<div className="stack">
      {preview.item.mimeType.startsWith("image/")?<div className="attachment-preview"><Image fill unoptimized sizes="(max-width: 680px) 100vw, 640px" src={preview.url} alt={preview.item.fileName}/></div>:preview.item.mimeType==="application/pdf"?<iframe className="attachment-frame" src={preview.url} title={preview.item.fileName}/>:<div className="card-flat row"><File/><span>Ce format peut être téléchargé, mais pas prévisualisé.</span></div>}
      <a className="button button-primary" href={preview.url} target="_blank" rel="noreferrer" download={preview.item.fileName}><Download size={18}/>Ouvrir ou télécharger</a>
    </div>}</Sheet>
  </Card>;
}
