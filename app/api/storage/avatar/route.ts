import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentBudgyUserId } from "@/lib/neon/server-data";
import { getStorageClient, getStorageConfig } from "@/lib/storage/server";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size > 5_000_000) {
    return Response.json({ message: "Image invalide (PNG, JPEG ou WebP, 5 Mo maximum)." }, { status: 400 });
  }
  const userId = await getCurrentBudgyUserId();
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const key = `${userId}/avatar-${Date.now()}.${extension}`;
  const bucket = "budgy-avatars";
  await getStorageClient().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(await file.arrayBuffer()),
    ContentType: file.type,
  }));
  const { endpoint } = getStorageConfig();
  return Response.json({ path: key, url: `${endpoint}/${bucket}/${key}` });
}
