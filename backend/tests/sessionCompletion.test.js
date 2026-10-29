import test from 'node:test';
import assert from 'node:assert/strict';

// Test GuestDownload service idempotency & concurrency
const { createGuestDownload, downloadUrlFor, isDownloadLive, DOWNLOAD_TTL_MS } = await import('../services/guestDownloadService.js');
const GuestDownload = (await import('../models/GuestDownload.js')).default;
const Photo = (await import('../models/Photo.js')).default;

test('HP-DEF-01: downloadUrlFor generates stable, normalized download URLs', () => {
  const url1 = downloadUrlFor('abc123xyz');
  assert.ok(url1.endsWith('/download/abc123xyz'));
  assert.ok(!url1.includes('//download'));
});

test('HP-DEF-01: isDownloadLive checks 24-hour expiration boundary', () => {
  const now = new Date();
  const future = new Date(now.getTime() + 10000);
  const past = new Date(now.getTime() - 10000);

  assert.equal(isDownloadLive({ expiresAt: future }, now), true);
  assert.equal(isDownloadLive({ expiresAt: past }, now), false);
  assert.equal(isDownloadLive(null, now), false);
  assert.equal(isDownloadLive({}, now), false);
});

test('HP-DEF-01: createGuestDownload returns null if no composite or photos', async () => {
  const result = await createGuestDownload({
    compositeUrl: null,
    photoUrls: [],
  });
  assert.equal(result, null);
});

test('HP-DEF-01: createGuestDownload returns existing active record when called repeatedly for same session', async () => {
  const orgId = '660e8400ece9e10000000001';
  const sessId = 'test-session-idempotency-1';

  // Mock GuestDownload findOne to simulate an existing active session record
  const mockExisting = {
    downloadId: 'canonical_download_id_999',
    organizationId: orgId,
    sessionId: sessId,
    expiresAt: new Date(Date.now() + DOWNLOAD_TTL_MS),
    compositeUrl: 'https://cdn.example.com/composite.jpg',
    photoUrls: ['https://cdn.example.com/p1.jpg'],
  };

  const origFindOne = GuestDownload.findOne;
  GuestDownload.findOne = async (query) => {
    if (query.organizationId === orgId && query.sessionId === sessId) {
      return mockExisting;
    }
    return null;
  };

  try {
    const download = await createGuestDownload({
      organizationId: orgId,
      sessionId: sessId,
      compositeUrl: 'https://cdn.example.com/composite.jpg',
      photoUrls: ['https://cdn.example.com/p1.jpg'],
    });

    assert.equal(download.downloadId, 'canonical_download_id_999');
    assert.equal(download.sessionId, sessId);
  } finally {
    GuestDownload.findOne = origFindOne;
  }
});

test('HP-DEF-01: createGuestDownload uses atomic findOneAndUpdate with $setOnInsert for new session', async () => {
  const orgId = '660e8400ece9e10000000002';
  const sessId = 'test-session-concurrency-1';

  let findOneAndUpdateCalled = false;
  let capturedQuery = null;
  let capturedUpdate = null;

  const origFindOne = GuestDownload.findOne;
  const origFindOneAndUpdate = GuestDownload.findOneAndUpdate;

  GuestDownload.findOne = async () => null; // not found initially
  GuestDownload.findOneAndUpdate = async (query, update, options) => {
    findOneAndUpdateCalled = true;
    capturedQuery = query;
    capturedUpdate = update;
    return {
      downloadId: update.$setOnInsert.downloadId,
      organizationId: query.organizationId,
      sessionId: query.sessionId,
      expiresAt: update.$setOnInsert.expiresAt,
    };
  };

  try {
    const download = await createGuestDownload({
      organizationId: orgId,
      sessionId: sessId,
      compositeUrl: 'https://cdn.example.com/composite.jpg',
      photoUrls: ['https://cdn.example.com/p1.jpg'],
    });

    assert.equal(findOneAndUpdateCalled, true, 'Must use findOneAndUpdate for atomic insertion');
    assert.equal(capturedQuery.organizationId, orgId);
    assert.equal(capturedQuery.sessionId, sessId);
    assert.ok(capturedUpdate.$setOnInsert.downloadId, 'Must generate unique downloadId on insert');
    assert.equal(download.sessionId, sessId);
  } finally {
    GuestDownload.findOne = origFindOne;
    GuestDownload.findOneAndUpdate = origFindOneAndUpdate;
  }
});

test('HP-DEF-01: concurrent calls to createGuestDownload resolve to single canonical record', async () => {
  const orgId = '660e8400ece9e10000000003';
  const sessId = 'test-session-race-1';

  let dbStore = null;

  const origFindOne = GuestDownload.findOne;
  const origFindOneAndUpdate = GuestDownload.findOneAndUpdate;

  GuestDownload.findOne = async (query) => {
    return dbStore;
  };
  GuestDownload.findOneAndUpdate = async (query, update) => {
    if (!dbStore) {
      dbStore = {
        downloadId: update.$setOnInsert.downloadId,
        organizationId: query.organizationId,
        sessionId: query.sessionId,
        compositeUrl: update.$setOnInsert.compositeUrl,
      };
    }
    return dbStore;
  };

  try {
    const [res1, res2] = await Promise.all([
      createGuestDownload({
        organizationId: orgId,
        sessionId: sessId,
        compositeUrl: 'https://cdn.example.com/composite.jpg',
        photoUrls: ['https://cdn.example.com/p1.jpg'],
      }),
      createGuestDownload({
        organizationId: orgId,
        sessionId: sessId,
        compositeUrl: 'https://cdn.example.com/composite.jpg',
        photoUrls: ['https://cdn.example.com/p1.jpg'],
      }),
    ]);

    assert.equal(res1.downloadId, res2.downloadId, 'Concurrent callers must receive identical downloadId');
    assert.equal(res1.sessionId, sessId);
  } finally {
    GuestDownload.findOne = origFindOne;
    GuestDownload.findOneAndUpdate = origFindOneAndUpdate;
  }
});

test('HP-DEF-01: Photo schema has sessionId, compositeUrl, and organizationId properties declared', () => {
  const schemaPaths = Photo.schema.paths;
  assert.ok(schemaPaths['sessionId'], 'Photo schema must have sessionId field');
  assert.ok(schemaPaths['compositeUrl'], 'Photo schema must have compositeUrl field');
  assert.ok(schemaPaths['organizationId'], 'Photo schema must have organizationId field');
  assert.ok(schemaPaths['payloadFingerprint'], 'Photo schema must have payloadFingerprint field');
});

test('HP-DEF-01: GuestDownload schema has payloadFingerprint declared', () => {
  const schemaPaths = GuestDownload.schema.paths;
  assert.ok(schemaPaths['payloadFingerprint'], 'GuestDownload schema must have payloadFingerprint field');
});

// ─── FIX 3: Cryptographic Session Payload Fingerprinting Tests ────────────────

const { computeNormalizedImageHash, computeSessionPayloadFingerprint } = await import('../routes/boothRoutes.js');

test('Fix 3: same bytes encoded identically produce identical image hash', () => {
  const rawBytes = Buffer.from('happy-pix-test-image-bytes-1');
  const b64 = rawBytes.toString('base64');
  const dataUrl1 = `data:image/jpeg;base64,${b64}`;
  const dataUrl2 = `data:image/jpeg;base64,${b64}`;

  const hash1 = computeNormalizedImageHash(dataUrl1);
  const hash2 = computeNormalizedImageHash(dataUrl2);
  assert.equal(hash1, hash2);
  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.length, 64); // sha256 hex
});

test('Fix 3: same bytes with formatting differences (whitespace, jpg vs jpeg) normalize to identical hash', () => {
  const rawBytes = Buffer.from('happy-pix-normalized-test-bytes');
  const b64 = rawBytes.toString('base64');
  const dataUrlJpeg = `data:image/jpeg;base64,${b64}`;
  const dataUrlJpgWithWhitespace = `data:image/jpg;base64,  ${b64}\n  `;

  const hash1 = computeNormalizedImageHash(dataUrlJpeg);
  const hash2 = computeNormalizedImageHash(dataUrlJpgWithWhitespace);
  assert.equal(hash1, hash2, 'Normalized image bytes must match despite whitespace or jpg/jpeg alias');
});

test('Fix 3: different image bytes produce different image hashes', () => {
  const dataUrlA = `data:image/jpeg;base64,${Buffer.from('image-content-A').toString('base64')}`;
  const dataUrlB = `data:image/jpeg;base64,${Buffer.from('image-content-B').toString('base64')}`;

  const hashA = computeNormalizedImageHash(dataUrlA);
  const hashB = computeNormalizedImageHash(dataUrlB);
  assert.notEqual(hashA, hashB);
});

test('Fix 3: deterministic session payload fingerprint matches for identical retries', () => {
  const comp = `data:image/jpeg;base64,${Buffer.from('comp-image').toString('base64')}`;
  const p1 = `data:image/jpeg;base64,${Buffer.from('p1-image').toString('base64')}`;
  const p2 = `data:image/jpeg;base64,${Buffer.from('p2-image').toString('base64')}`;

  const fp1 = computeSessionPayloadFingerprint(comp, [p1, p2]);
  const fp2 = computeSessionPayloadFingerprint(comp, [p1, p2]);
  assert.equal(fp1, fp2);
});

test('Fix 3: different composite bytes change the session fingerprint', () => {
  const compA = `data:image/jpeg;base64,${Buffer.from('comp-image-A').toString('base64')}`;
  const compB = `data:image/jpeg;base64,${Buffer.from('comp-image-B').toString('base64')}`;
  const p1 = `data:image/jpeg;base64,${Buffer.from('p1-image').toString('base64')}`;

  const fpA = computeSessionPayloadFingerprint(compA, [p1]);
  const fpB = computeSessionPayloadFingerprint(compB, [p1]);
  assert.notEqual(fpA, fpB);
});

test('Fix 3: reordered photos change the session fingerprint (order is semantically significant)', () => {
  const comp = `data:image/jpeg;base64,${Buffer.from('comp-image').toString('base64')}`;
  const p1 = `data:image/jpeg;base64,${Buffer.from('photo-1').toString('base64')}`;
  const p2 = `data:image/jpeg;base64,${Buffer.from('photo-2').toString('base64')}`;

  const fpNormal = computeSessionPayloadFingerprint(comp, [p1, p2]);
  const fpReordered = computeSessionPayloadFingerprint(comp, [p2, p1]);
  assert.notEqual(fpNormal, fpReordered, 'Photo order permutation must produce different fingerprint');
});

test('Fix 3: different photo bytes with same photo count change the session fingerprint', () => {
  const comp = `data:image/jpeg;base64,${Buffer.from('comp-image').toString('base64')}`;
  const p1A = `data:image/jpeg;base64,${Buffer.from('camera-frame-A').toString('base64')}`;
  const p1B = `data:image/jpeg;base64,${Buffer.from('camera-frame-B').toString('base64')}`;

  const fpA = computeSessionPayloadFingerprint(comp, [p1A]);
  const fpB = computeSessionPayloadFingerprint(comp, [p1B]);
  assert.notEqual(fpA, fpB, 'Different photo content with same count must be detected as conflict');
});

test('Fix 3: invalid Base64, unsupported formats, and oversized payloads are rejected', () => {
  // Invalid Base64 characters
  assert.throws(
    () => computeNormalizedImageHash('data:image/jpeg;base64,???not_base64!!!'),
    (err) => err.status === 400 && err.code === 'INVALID_PHOTO_FORMAT'
  );

  // Unsupported MIME format (gif)
  assert.throws(
    () => computeNormalizedImageHash('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
    (err) => err.status === 400 && err.code === 'INVALID_PHOTO_FORMAT'
  );

  // Oversized payload (> 25MB)
  const hugePayload = 'data:image/jpeg;base64,' + 'A'.repeat(26 * 1024 * 1024);
  assert.throws(
    () => computeNormalizedImageHash(hugePayload),
    (err) => err.status === 400 && err.code === 'PAYLOAD_TOO_LARGE'
  );
});

// ─── FIX 4: MongoDB Duplicate-Key Recovery (Cross-Instance Concurrency) ────────

test('Fix 4: createGuestDownload recovers canonical record on MongoDB duplicate-key error (code 11000)', async () => {
  const orgId = '660e8400ece9e10000000009';
  const sessId = 'test-session-dupkey-1';
  const canonicalRecord = {
    downloadId: 'recovered_canonical_id_777',
    organizationId: orgId,
    sessionId: sessId,
    compositeUrl: 'https://cdn.example.com/canonical.jpg',
  };

  const origFindOneAndUpdate = GuestDownload.findOneAndUpdate;
  const origFindOne = GuestDownload.findOne;

  let findOneCalled = false;

  // Simulate concurrent insertion racing: initial findOne returns null,
  // findOneAndUpdate throws MongoDB duplicate key error code 11000
  GuestDownload.findOne = async (query) => {
    if (findOneCalled) {
      return canonicalRecord;
    }
    return null;
  };

  GuestDownload.findOneAndUpdate = async () => {
    findOneCalled = true;
    const mongoError = new Error('E11000 duplicate key error collection: happypix.guestdownloads index: sessionId_1 dup key');
    mongoError.code = 11000;
    mongoError.name = 'MongoServerError';
    throw mongoError;
  };

  try {
    const result = await createGuestDownload({
      organizationId: orgId,
      sessionId: sessId,
      compositeUrl: 'https://cdn.example.com/composite.jpg',
      photoUrls: ['https://cdn.example.com/p1.jpg'],
      payloadFingerprint: 'mock_fingerprint_123',
    });

    assert.ok(result, 'Must recover canonical record rather than throwing error');
    assert.equal(result.downloadId, 'recovered_canonical_id_777');
    assert.equal(result.sessionId, sessId);
  } finally {
    GuestDownload.findOneAndUpdate = origFindOneAndUpdate;
    GuestDownload.findOne = origFindOne;
  }
});
