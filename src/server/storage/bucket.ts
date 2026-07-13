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
      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key
        })
      );
      return {
        body: await bodyToBuffer(response.Body as DownloadBody),
        contentType: response.ContentType
      };
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
