import { S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.AWS_ENDPOINT_URL_S3?.replace(/\/$/, "");
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION;

export function getStorageConfig() {
  if (!endpoint || !accessKeyId || !secretAccessKey || !region) {
    throw new Error("Neon Object Storage is not configured.");
  }
  return { endpoint, region };
}

export function getStorageClient() {
  const config = getStorageConfig();
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
  });
}

