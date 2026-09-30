import { fileURLToPath } from 'node:url';
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

function validateAssetPrefixes({ sourceBucket, sourcePrefix, targetBucket, targetPrefix, targetSubprefix }) {
  const normalizedSourcePrefix = normalizePrefix(sourcePrefix);
  const normalizedTargetPrefix = normalizePrefix(targetPrefix);
  const normalizedTargetSubprefix = normalizePrefix(targetSubprefix);
  if (!sourceBucket || !targetBucket) throw new Error('Both source and target S3 buckets are required.');
  if (!normalizedSourcePrefix) throw new Error('LEGACY_AWS_S3_PREFIX must be configured explicitly.');
  if (!normalizedTargetPrefix.startsWith('v2/')) throw new Error('AWS_S3_PREFIX must be a V2 prefix.');
  const destination = `${normalizedTargetPrefix}${normalizedTargetSubprefix}`;
  if (sourceBucket === targetBucket && (destination.startsWith(normalizedSourcePrefix) || normalizedSourcePrefix.startsWith(destination))) {
    throw new Error('Legacy source prefix and V2 destination prefix must not overlap.');
  }
}

export function assetSyncConfig(env = process.env) {
  const config = {
    sourceBucket: env.LEGACY_AWS_S3_BUCKET?.trim() || env.AWS_S3_BUCKET?.trim(),
    targetBucket: env.AWS_S3_BUCKET?.trim(),
    sourcePrefix: env.LEGACY_AWS_S3_PREFIX?.trim() || env.AWS_S3_SHARE_PREFIX?.trim() || 'shares/',
    targetPrefix: env.AWS_S3_PREFIX?.trim() || 'v2/uploads/',
    targetSubprefix: env.LEGACY_ASSET_TARGET_SUBPREFIX?.trim() || 'legacy/',
    region: env.AWS_REGION?.trim(),
  };
  const missing = [];
  if (!config.region) missing.push('AWS_REGION');
  if (!config.targetBucket) missing.push('AWS_S3_BUCKET');
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  validateAssetPrefixes(config);
  return config;
}

export async function syncLegacyAssets({
  client,
  sourceBucket,
  sourcePrefix,
  targetBucket,
  targetPrefix,
  targetSubprefix = 'legacy/',
  apply = false,
  onProgress = () => {},
  requestTimeoutMs = 60000,
}) {
  const normalizedSourcePrefix = normalizePrefix(sourcePrefix);
  const normalizedTargetPrefix = normalizePrefix(targetPrefix);
  const normalizedTargetSubprefix = normalizePrefix(targetSubprefix);

  validateAssetPrefixes({ sourceBucket, sourcePrefix: normalizedSourcePrefix, targetBucket, targetPrefix: normalizedTargetPrefix, targetSubprefix: normalizedTargetSubprefix });

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

  let token, pageNumber = 0;
  let operation = 'starting';
  const progress = () => onProgress({ ...report, operation });
  const send = async (command, label) => {
    operation = label;
    try {
      return await client.send(command, { abortSignal: AbortSignal.timeout(requestTimeoutMs) });
    } catch (error) {
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
        throw new Error(`S3 request timed out after ${requestTimeoutMs / 1000}s during ${label}; rerun safely.`, { cause: error });
      }
      throw error;
    }
  };
  const heartbeat = setInterval(progress, 10000);
  try {
    do {
      pageNumber++;
      operation = `listing source page ${pageNumber}`;
      progress();
      const page = await send(new ListObjectsV2Command({
        Bucket: sourceBucket,
        Prefix: normalizedSourcePrefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      }), `listing source page ${pageNumber}`);
      operation = `checking source page ${pageNumber} (${page.Contents?.length || 0} objects)`;
      progress();

      for (const object of page.Contents || []) {
        if (!object.Key || object.Key.endsWith('/')) continue;
        report.discovered += 1;
        report.bytesDiscovered += object.Size || 0;
        if (report.discovered % 25 === 0) progress();
        const destinationKey = destinationKeyForLegacyAsset(
          object.Key,
          normalizedSourcePrefix,
          normalizedTargetPrefix,
          normalizedTargetSubprefix,
        );

        let target;
        try {
          target = await send(new HeadObjectCommand({ Bucket: targetBucket, Key: destinationKey }), `checking destination (${report.discovered} processed)`);
        } catch (error) {
          const status = error?.$metadata?.httpStatusCode;
          if (status !== 404 && error?.name !== 'NotFound' && error?.name !== 'NoSuchKey') throw error;
        }

        const sourceEtag = object.ETag?.replaceAll('"', '');
        const targetEtag = target?.ETag?.replaceAll('"', '');
        const sameSize = typeof object.Size === 'number' && target?.ContentLength === object.Size;
        const sameEtag = Boolean(sourceEtag && targetEtag && sourceEtag === targetEtag);

        const recordedSourceEtag = target?.Metadata?.['legacy-source-etag'];
        if (target && sameSize && (sameEtag || (sourceEtag && recordedSourceEtag === sourceEtag))) {
          report.unchanged += 1;
          continue;
        }

        if (!apply) {
          report.wouldCopy += 1;
          continue;
        }

        try {
          // Preserve source metadata and presentation headers while recording the
          // source ETag. This also makes repeat copies stable with S3 encryption.
          const sourceHead = await send(new HeadObjectCommand({ Bucket: sourceBucket, Key: object.Key }), 'reading source metadata');
          if (sourceHead.ETag !== object.ETag || sourceHead.ContentLength !== object.Size) throw new Error('Source object changed during scan; rerun safely.');
          const headers = Object.fromEntries(['ContentType', 'CacheControl', 'ContentDisposition', 'ContentEncoding', 'ContentLanguage', 'Expires', 'WebsiteRedirectLocation']
            .filter(key => sourceHead[key] !== undefined).map(key => [key, sourceHead[key]]));
          await send(new CopyObjectCommand({
            Bucket: targetBucket,
            Key: destinationKey,
            CopySource: encodeCopySource(sourceBucket, object.Key),
            CopySourceIfMatch: object.ETag,
            MetadataDirective: 'REPLACE',
            Metadata: { ...sourceHead.Metadata, ...(sourceEtag ? { 'legacy-source-etag': sourceEtag } : {}) },
            ...headers,
          }), `copying asset (${report.discovered} processed)`);
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

      if (page.IsTruncated && !page.NextContinuationToken) throw new Error('S3 returned a truncated page without a continuation token');
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    report.partial = report.failed > 0;
    operation = 'finished';
    progress();
    return report;
  } finally { clearInterval(heartbeat); }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg))) throw new Error('Supported options: --dry-run or --apply');
  if (apply && args.includes('--dry-run')) throw new Error('Choose --apply or --dry-run');
  const config = assetSyncConfig();
  const client = new S3Client({ region: config.region, maxAttempts: 3 });
  const started = Date.now();
  console.error(`[assets] ${apply ? 'Apply' : 'Dry run'}: s3://${config.sourceBucket}/${normalizePrefix(config.sourcePrefix)} → s3://${config.targetBucket}/${normalizePrefix(config.targetPrefix)}${normalizePrefix(config.targetSubprefix)}`);
  try {
    const report = await syncLegacyAssets({
      client,
      ...config,
      apply,
      onProgress: report => console.error(`[assets] ${report.operation}: scanned=${report.discovered}, copied=${report.copied}, wouldCopy=${report.wouldCopy}, unchanged=${report.unchanged}, failed=${report.failed} (${Math.round((Date.now() - started) / 1000)}s)`),
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.failed) process.exitCode = 1;
  } finally {
    client.destroy();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
