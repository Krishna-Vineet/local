/**
 * Schema guards — boot-time repairs for models that a stale or foreign copy of
 * the code can declare wrongly.
 *
 * The problem this exists for
 * ──────────────────────────
 * `Device.deviceToken` used to be a schema path whose value a `pre('save')` hook
 * deliberately cleared after hashing it. On any copy of the model where that
 * path is also flagged `required: true`, every device write fails:
 *
 *   Device validation failed: deviceToken: Path `deviceToken` is required.
 *
 * …which surfaces as HTTP 500 `INTERNAL` from whatever route happens to touch a
 * device — pairing, session completion, or the CRM screen the operator was on.
 * `models/Device.js` no longer declares the path at all, but a long-running
 * process, a second checkout, or a deployment that has not picked up the change
 * can still hold the old schema. The symptom then contradicts the source file,
 * which is exactly how this cost an afternoon.
 *
 * So the server repairs itself on boot: any compiled model that still declares
 * `deviceToken` has it removed, and a `pre('save')` hook is attached so a caller
 * that assigns a raw token still gets it hashed instead of persisted. It is
 * idempotent and logs loudly, because a guard that silently "fixes" a mismatch
 * hides the real problem.
 */
import mongoose from 'mongoose';
import { hashDeviceToken } from '../utils/crypto.js';

const isRequired = (schemaType) =>
  Boolean(schemaType && (schemaType.isRequired === true || schemaType.options?.required));

/**
 * Removes a legacy plaintext `deviceToken` path from `model`'s schema and makes
 * sure a raw token assigned by an older caller is hashed rather than saved.
 *
 * @returns {{
 *   model: string,
 *   path: 'absent' | 'optional' | 'required',
 *   action: 'none' | 'removed' | 'required-dropped',
 *   warnings: string[]
 * }}
 */
export function guardDeviceToken(modelName = 'Device') {
  const report = { model: modelName, path: 'absent', action: 'none', warnings: [] };
  const model = mongoose.models[modelName];
  if (!model) return report;

  const schema = model.schema;
  const schemaType = schema.path('deviceToken');
  if (!schemaType) return report;

  report.path = isRequired(schemaType) ? 'required' : 'optional';
  report.action = report.path === 'required' ? 'required-dropped' : 'removed';

  // `schema.remove` drops the path, its validators and its index descriptor, so
  // neither `validate()` nor `save()` can complain about it again.
  schema.remove('deviceToken');

  // …and it comes back as a write-only virtual, because callers of the old
  // model hand the raw token to the constructor or assign it directly and then
  // rely on a hook to hash it. A virtual setter keeps those call sites working
  // while making plaintext impossible to persist (a virtual has no column and
  // cannot be `required`).
  schema.virtual('deviceToken').set(function deviceTokenSetter(raw) {
    if (typeof raw !== 'string' || raw.length === 0) return;
    const hash = hashDeviceToken(raw);
    if (hash) this.set('deviceTokenHash', hash);
  });

  // Belt and braces: if something still writes the raw value into the document
  // with `strict: false`, hash it and drop it before the document is stored.
  schema.pre('save', function deviceTokenGuard() {
    const raw = this._doc?.deviceToken;
    if (typeof raw !== 'string' || raw.length === 0) return;
    const hash = hashDeviceToken(raw);
    if (hash) this.set('deviceTokenHash', hash);
    delete this._doc.deviceToken;
  });

  report.warnings.push(
    `models/${modelName}.js declares a plaintext \`deviceToken\` path` +
      (report.path === 'required'
        ? ' and requires it — that combination fails every device write'
        : '') +
      '. The path was removed at boot; update the model file (see backend/models/Device.js).'
  );
  return report;
}

/** Runs every guard. Returns one report per model so a health endpoint can show it. */
export function applySchemaGuards() {
  const reports = [];
  for (const modelName of ['Device']) {
    const report = guardDeviceToken(modelName);
    reports.push(report);
    for (const warning of report.warnings) console.warn(`⚠️  ${warning}`);
  }
  return reports;
}

/** A compact, read-only view of the Device token schema — for diagnostics. */
export function describeDeviceTokenPath(modelName = 'Device') {
  const schema = mongoose.models[modelName]?.schema;
  if (!schema) return { loaded: false };
  const schemaType = schema.path('deviceToken');
  return {
    loaded: true,
    plaintextPath: schemaType ? (isRequired(schemaType) ? 'required' : 'optional') : 'absent',
    hashedPath: Boolean(schema.path('deviceTokenHash')),
  };
}
