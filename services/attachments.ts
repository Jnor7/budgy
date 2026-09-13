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
  void userId;
  const body = new FormData();
  body.set("file", file);
  const response = await fetch("/api/storage/attachments", { method: "POST", body });
  const result = await response.json() as { path?: string; error?: string };
  if (!response.ok || !result.path) throw new Error(result.error ?? "Envoi du fichier impossible.");
  return result.path;
}

export async function attachmentPreviewUrl(storagePath: string, localMode: boolean) {
  if (localMode || storagePath.startsWith("data:")) return storagePath;
  const response = await fetch(`/api/storage/attachments?path=${encodeURIComponent(storagePath)}`);
  const result = await response.json() as { url?: string; error?: string };
  if (!response.ok || !result.url) throw new Error(result.error ?? "Aperçu du fichier impossible.");
  return result.url;
}

export async function deleteAttachmentFile(storagePath: string, localMode: boolean) {
  if (localMode || storagePath.startsWith("data:")) return;
  const response = await fetch(`/api/storage/attachments?path=${encodeURIComponent(storagePath)}`, { method: "DELETE" });
  if (!response.ok) {
    const result = await response.json() as { error?: string };
    throw new Error(result.error ?? "Suppression du fichier impossible.");
  }
}
