import { CopyObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

function normalizePrefix(value) {
  const trimmed = String(value || '').replace(/^\/+/, '');
  return trimmed && !trimmed.endsWith('/') ? `${trimmed}/` : trimmed;
}

function encodeCopySource(bucket, key) {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function destinationKeyForLegacyAsset(sourceKey, sourcePrefix, targetPrefix, targetSubprefix = 'legacy/') {
  const source = normalizePrefix(sourcePrefix);
  const target = normalizePrefix(targetPrefix);
  const sub = normalizePrefix(targetSubprefix);
  if (!sourceKey.startsWith(source)) throw new Error(`Source key ${sourceKey} is outside legacy prefix ${source}`);
  const relative = sourceKey.slice(source.length);
  if (!relative) throw new Error('Cannot map the legacy prefix root as an object.');
  return `${target}${sub}${relative}`;
}

export async function syncLegacyAssets({
  client,
  sourceBucket,
  sourcePrefix,
  targetBucket,
  targetPrefix,
  targetSubprefix = 'legacy/',
  apply = false,
}) {
  const normalizedSourcePrefix = normalizePrefix(sourcePrefix);
  const normalizedTargetPrefix = normalizePrefix(targetPrefix);
  const normalizedTargetSubprefix = normalizePrefix(targetSubprefix);

  if (!sourceBucket || !targetBucket) throw new Error('Both source and target S3 buckets are required.');
  if (!normalizedSourcePrefix) throw new Error('LEGACY_AWS_S3_PREFIX must be configured explicitly.');
  if (!normalizedTargetPrefix.startsWith('v2/')) throw new Error('AWS_S3_PREFIX must be a V2 prefix.');
  if (sourceBucket === targetBucket && normalizedSourcePrefix === `${normalizedTargetPrefix}${normalizedTargetSubprefix}`) {
    throw new Error('Legacy source prefix and V2 destination prefix cannot be the same.');
  }

  const report = {
    status: apply ? 'completed' : 'dry-run',
    sourceBucket,
    sourcePrefix: normalizedSourcePrefix,
    targetBucket,
    targetPrefix: `${normalizedTargetPrefix}${normalizedTargetSubprefix}`,
    discovered: 0,
    copied: 0,
    wouldCopy: 0,
    unchanged: 0,
    failed: 0,
    bytesDiscovered: 0,
    bytesCopied: 0,
    partial: false,
    failures: [],
  };

  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: sourceBucket,
      Prefix: normalizedSourcePrefix,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));

    for (const object of page.Contents || []) {
      if (!object.Key || object.Key.endsWith('/')) continue;
      report.discovered += 1;
      report.bytesDiscovered += object.Size || 0;
      const destinationKey = destinationKeyForLegacyAsset(
        object.Key,
        normalizedSourcePrefix,
        normalizedTargetPrefix,
        normalizedTargetSubprefix,
      );

      let target;
      try {
        target = await client.send(new HeadObjectCommand({ Bucket: targetBucket, Key: destinationKey }));
      } catch (error) {
        const status = error?.$metadata?.httpStatusCode;
        if (status !== 404 && error?.name !== 'NotFound' && error?.name !== 'NoSuchKey') throw error;
      }

      const sourceEtag = object.ETag?.replaceAll('"', '');
      const targetEtag = target?.ETag?.replaceAll('"', '');
      const sameSize = typeof object.Size === 'number' && target?.ContentLength === object.Size;
      const sameEtag = Boolean(sourceEtag && targetEtag && sourceEtag === targetEtag);

      if (target && (sameEtag || sameSize)) {
        report.unchanged += 1;
        continue;
      }

      if (!apply) {
        report.wouldCopy += 1;
        continue;
      }

      try {
        await client.send(new CopyObjectCommand({
          Bucket: targetBucket,
          Key: destinationKey,
          CopySource: encodeCopySource(sourceBucket, object.Key),
          MetadataDirective: 'COPY',
        }));
        report.copied += 1;
        report.bytesCopied += object.Size || 0;
      } catch (error) {
        report.failed += 1;
        if (report.failures.length < 25) {
          report.failures.push({
            sourceKey: object.Key,
            destinationKey,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  return report;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const sourceBucket = process.env.LEGACY_AWS_S3_BUCKET?.trim() || process.env.AWS_S3_BUCKET?.trim();
  const targetBucket = process.env.AWS_S3_BUCKET?.trim();
  const sourcePrefix = process.env.LEGACY_AWS_S3_PREFIX?.trim()
    || process.env.AWS_S3_SHARE_PREFIX?.trim()
    || 'shares/';
  const targetPrefix = process.env.AWS_S3_PREFIX?.trim() || 'v2/uploads/';
  const targetSubprefix = process.env.LEGACY_ASSET_TARGET_SUBPREFIX?.trim() || 'legacy/';
  const region = process.env.AWS_REGION?.trim();

  const missing = [];
  if (!region) missing.push('AWS_REGION');
  if (!targetBucket) missing.push('AWS_S3_BUCKET');
  if (!sourceBucket) missing.push('LEGACY_AWS_S3_BUCKET or AWS_S3_BUCKET');
  if (missing.length) throw new Error(`Missing required environment variable${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`);

  const client = new S3Client({ region });
  try {
    const report = await syncLegacyAssets({
      client,
      sourceBucket,
      sourcePrefix,
      targetBucket,
      targetPrefix,
      targetSubprefix,
      apply,
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.failed) process.exitCode = 1;
  } finally {
    client.destroy();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
