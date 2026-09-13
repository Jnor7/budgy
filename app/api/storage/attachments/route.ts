import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCurrentBudgyUserId, neonDataFetch } from "@/lib/neon/server-data";
import { getStorageClient } from "@/lib/storage/server";

const bucket = "budgy-attachments";
const safeName = (name: string) => name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");

async function canAccess(storagePath: string) {
  const query = new URLSearchParams({ select: "id", storage_path: `eq.${storagePath}`, limit: "1" });
  const response = await neonDataFetch(`attachments?${query}`);
  if (!response.ok) return false;
  const rows = await response.json() as unknown[];
  return rows.length === 1;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 10_000_000) {
    return Response.json({ message: "Fichier invalide (10 Mo maximum)." }, { status: 400 });
  }
  const userId = await getCurrentBudgyUserId();
  const key = `${userId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  await getStorageClient().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(await file.arrayBuffer()),
    ContentType: file.type || "application/octet-stream",
  }));
  return Response.json({ path: key });
}

export async function GET(request: Request) {
  const storagePath = new URL(request.url).searchParams.get("path") ?? "";
  if (!storagePath || !(await canAccess(storagePath))) return Response.json({ message: "Forbidden" }, { status: 403 });
  const url = await getSignedUrl(getStorageClient(), new GetObjectCommand({ Bucket: bucket, Key: storagePath }), { expiresIn: 900 });
  return Response.json({ url });
}

export async function DELETE(request: Request) {
  const storagePath = new URL(request.url).searchParams.get("path") ?? "";
  if (!storagePath || !(await canAccess(storagePath))) return Response.json({ message: "Forbidden" }, { status: 403 });
  await getStorageClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: storagePath }));
  return new Response(null, { status: 204 });
}
