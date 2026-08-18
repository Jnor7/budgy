import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const BUCKET = "budgy-attachments";

const safeName = (name: string) => name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");

const readDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error ?? new Error("Lecture du fichier impossible."));
  reader.readAsDataURL(file);
});

export async function uploadAttachmentFile(file: File, userId: string, localMode: boolean) {
  if (localMode) {
    if (file.size > 1_500_000) throw new Error("En mode local, le fichier doit faire moins de 1,5 Mo.");
    return readDataUrl(file);
  }
  if (file.size > 10_000_000) throw new Error("Le fichier doit faire moins de 10 Mo.");
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase n’est pas configuré.");
  const path = `${userId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await client.storage.from(BUCKET).upload(path, file, { contentType:file.type || "application/octet-stream", upsert:false });
  if (error) throw error;
  return path;
}

export async function attachmentPreviewUrl(storagePath: string, localMode: boolean) {
  if (localMode || storagePath.startsWith("data:")) return storagePath;
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase n’est pas configuré.");
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 15);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachmentFile(storagePath: string, localMode: boolean) {
  if (localMode || storagePath.startsWith("data:")) return;
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase n’est pas configuré.");
  const { error } = await client.storage.from(BUCKET).remove([storagePath]);
  if (error) throw error;
}
