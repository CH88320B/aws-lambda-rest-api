const { HttpError } = require('./response');

/**
 * Small declarative validator. Each rule: { type, required, min, max, minLength, maxLength, pattern }.
 * Unknown fields are stripped. When `partial` is true, required checks are skipped (partial updates).
 */
function validate(input, schema, { partial = false } = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  const errors = [];
  const out = {};

  for (const [field, rule] of Object.entries(schema)) {
    const value = input[field];

    if (value === undefined || value === null) {
      if (rule.required && !partial) errors.push({ field, message: 'is required' });
      continue;
    }

    const message = checkValue(value, rule);
    if (message) {
      errors.push({ field, message });
      continue;
    }
    out[field] = normalize(value, rule);
  }

  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  if (partial && Object.keys(out).length === 0) throw new HttpError(400, 'No updatable fields provided');
  return out;
}

function checkValue(value, rule) {
  switch (rule.type) {
    case 'string': {
      if (typeof value !== 'string') return 'must be a string';
      const v = value.trim();
      if (rule.required && v.length === 0) return 'must not be empty';
      if (rule.minLength && v.length < rule.minLength) return `must be at least ${rule.minLength} characters`;
      if (rule.maxLength && v.length > rule.maxLength) return `must be at most ${rule.maxLength} characters`;
      if (rule.pattern && !rule.pattern.test(v)) return 'has an invalid format';
      return null;
    }
    case 'number':
    case 'integer':
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'must be a number';
      if (rule.type === 'integer' && !Number.isInteger(value)) return 'must be an integer';
      if (rule.min !== undefined && value < rule.min) return `must be >= ${rule.min}`;
      if (rule.max !== undefined && value > rule.max) return `must be <= ${rule.max}`;
      return null;
    case 'array':
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) return 'must be an array of strings';
      return null;
    default:
      return null;
  }
}

function normalize(value, rule) {
  if (rule.type === 'string') return value.trim();
  if (rule.type === 'array') return [...new Set(value.map((v) => v.trim()).filter(Boolean))];
  return value;
}

module.exports = { validate };
