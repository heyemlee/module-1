import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

type BucketClient = Pick<S3Client, "send">;

type DownloadBody =
  | Uint8Array
  | { transformToByteArray: () => Promise<Uint8Array> }
  | AsyncIterable<Uint8Array>
  | undefined;

export type BucketObject = {
  body: Buffer;
  contentType: string | undefined;
};

export type BucketStorage = {
  uploadObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<BucketObject>;
  deleteObject(key: string): Promise<void>;
};

export function buildObjectKey(prefix: string, ...parts: string[]) {
  return [prefix, ...parts]
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

async function bodyToBuffer(body: DownloadBody) {
  if (!body) throw new Error("Bucket object has no body");
  if (body instanceof Uint8Array) return Buffer.from(body);
  if ("transformToByteArray" in body) {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

// The storage proxy (Tigris) occasionally resets a connection mid-download
// (ECONNRESET / "aborted" / socket hang up). The AWS SDK retries the initial
// request but NOT a reset while the response body streams, so a single swatch
// fetch can fail even though the stored object is intact — surfacing as random
// broken images across a gallery. GET is idempotent, so re-issue it a few times
// on transient network errors before giving up.
const GET_OBJECT_MAX_ATTEMPTS = 4;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientBucketError(error: unknown) {
  const meta = error as {
    code?: string;
    name?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const label = `${meta?.code ?? ""} ${meta?.name ?? ""} ${meta?.message ?? ""}`.toLowerCase();
  if (/econnreset|econnaborted|etimedout|epipe|aborted|socket hang up|timeout|network/.test(label)) {
    return true;
  }
  const status = meta?.$metadata?.httpStatusCode;
  return typeof status === "number" && status >= 500;
}

export function createBucketStorage({
  bucket,
  client
}: {
  bucket: string;
  client: BucketClient;
}): BucketStorage {
  return {
    async uploadObject(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType
        })
      );
    },

    async getObject(key) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= GET_OBJECT_MAX_ATTEMPTS; attempt++) {
        try {
          const response = await client.send(
            new GetObjectCommand({
              Bucket: bucket,
              Key: key
            })
          );
          // Buffer inside the try: a mid-stream reset throws here, not from send().
          const body = await bodyToBuffer(response.Body as DownloadBody);
          return { body, contentType: response.ContentType };
        } catch (error) {
          lastError = error;
          if (attempt < GET_OBJECT_MAX_ATTEMPTS && isTransientBucketError(error)) {
            await delay(150 * attempt);
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    },

    async deleteObject(key) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key
        })
      );
    }
  };
}

export function createBucketStorageFromEnv(
  env: Record<string, string | undefined>
): BucketStorage | null {
  const bucket = env.BUCKET;
  const endpoint = env.ENDPOINT;
  const accessKeyId = env.ACCESS_KEY_ID;
  const secretAccessKey = env.SECRET_ACCESS_KEY;

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;

  return createBucketStorage({
    bucket,
    client: new S3Client({
      region: env.REGION ?? "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey }
    })
  });
}
