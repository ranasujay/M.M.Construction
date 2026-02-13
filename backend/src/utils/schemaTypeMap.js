const mongoose = require('mongoose');

/**
 * Schema-aware type mapping utility for bulletproof backup / restore.
 *
 * Problem:  JSON.stringify() converts ObjectId → string, Date → string.
 *           JSON.parse() cannot reverse that automatically.
 *
 * Solution: At backup time we embed a "type map" extracted from every
 *           Mongoose schema. At restore time we walk each document and
 *           cast every field back to its correct type using the map.
 *
 * Supported types:
 *   ObjectId, Date, Number, Boolean, String, Mixed,
 *   SubDocArray (array of sub-documents), Array<T> (array of scalars),
 *   Embedded (single nested sub-document)
 */

// ─── 1. Extract a flat type-map from a Mongoose schema ──────────────

/**
 * Recursively walks a Mongoose schema and returns a flat object mapping
 * every dot-separated path to its type string.
 *
 * Example output for the Bill model:
 * {
 *   "_id":                 "ObjectId",
 *   "billNumber":          "String",
 *   "customer":            "ObjectId",
 *   "items":               "SubDocArray",
 *   "items._id":           "ObjectId",
 *   "items.product":       "ObjectId",
 *   "items.quantity":      "Number",
 *   "createdAt":           "Date",
 *   "updatedAt":           "Date",
 *   "__v":                 "Number",
 *   ...
 * }
 */
function extractTypeMap(schema, prefix = '') {
  const typeMap = {};

  for (const [pathName, schemaType] of Object.entries(schema.paths)) {
    const fullPath = prefix ? `${prefix}.${pathName}` : pathName;
    const instance = schemaType.instance;

    switch (instance) {
      case 'ObjectId':
      case 'ObjectID':
        typeMap[fullPath] = 'ObjectId';
        break;

      case 'Date':
        typeMap[fullPath] = 'Date';
        break;

      case 'Number':
        typeMap[fullPath] = 'Number';
        break;

      case 'Boolean':
        typeMap[fullPath] = 'Boolean';
        break;

      case 'String':
        typeMap[fullPath] = 'String';
        break;

      case 'Mixed':
        typeMap[fullPath] = 'Mixed';
        break;

      case 'Array':
        if (schemaType.schema) {
          // Array of sub-documents  (e.g. Bill.items, Worker.rateHistory)
          typeMap[fullPath] = 'SubDocArray';
          Object.assign(typeMap, extractTypeMap(schemaType.schema, fullPath));
        } else if (schemaType.caster && schemaType.caster.instance) {
          // Array of scalars (e.g. Array<String>, Array<ObjectId>)
          typeMap[fullPath] = `Array<${schemaType.caster.instance}>`;
        } else {
          typeMap[fullPath] = 'Array';
        }
        break;

      case 'Embedded':
        typeMap[fullPath] = 'Embedded';
        if (schemaType.schema) {
          Object.assign(typeMap, extractTypeMap(schemaType.schema, fullPath));
        }
        break;

      case 'Map':
        typeMap[fullPath] = 'Map';
        break;

      default:
        // Unknown — record but leave handling to fallback logic
        typeMap[fullPath] = instance || 'Unknown';
        break;
    }
  }

  return typeMap;
}

// ─── 2. Generate type maps for ALL models ───────────────────────────

/**
 * Takes the MODEL_MAP { key: MongooseModel } and returns
 * { key: { pathName: typeString, ... }, ... }
 */
function generateAllTypeMaps(modelMap) {
  const allTypeMaps = {};
  for (const [key, model] of Object.entries(modelMap)) {
    allTypeMaps[key] = extractTypeMap(model.schema);
  }
  return allTypeMaps;
}

// ─── 3. Value casting helpers ───────────────────────────────────────

const OID_RE = /^[a-f\d]{24}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Cast a single scalar value to targetType.
 */
function castValue(value, targetType) {
  if (value === null || value === undefined) return value;

  switch (targetType) {
    case 'ObjectId':
    case 'ObjectID':
      if (typeof value === 'string' && OID_RE.test(value)) {
        return new mongoose.Types.ObjectId(value);
      }
      return value;

    case 'Date':
      if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d;
      }
      if (typeof value === 'number') {
        return new Date(value);
      }
      // Already a Date from JSON reviver? keep it.
      return value;

    case 'Number':
      if (typeof value === 'string') {
        const n = Number(value);
        if (!isNaN(n)) return n;
      }
      return value;

    case 'Boolean':
      if (typeof value === 'string') {
        if (value === 'true') return true;
        if (value === 'false') return false;
      }
      return value;

    case 'String':
      // Strings stay as strings — important so that 24-char hex strings
      // that are MEANT to be strings (e.g. Counter._id) are NOT converted.
      return value;

    default:
      return value;
  }
}

/**
 * Deep-restore a Mixed (schema-less) value using heuristics.
 * We only convert unambiguous patterns: 24-char hex → ObjectId,
 * ISO timestamps → Date.
 */
function deepRestoreMixed(value) {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (OID_RE.test(value)) return new mongoose.Types.ObjectId(value);
    if (ISO_DATE_RE.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return value;
  }

  if (Array.isArray(value)) return value.map(deepRestoreMixed);

  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = deepRestoreMixed(v);
    }
    return out;
  }

  return value; // number, boolean, etc.
}

// ─── 4. Document-level casting ──────────────────────────────────────

/**
 * Cast every field in a document using the flat type map.
 *
 * @param {Object} doc       Raw document from JSON.parse
 * @param {Object} typeMap   Flat path→type map for this collection
 * @param {string} prefix    Internal — used for recursion into sub-docs
 * @returns {Object}         Document with correctly typed fields
 */
function castDocument(doc, typeMap, prefix = '') {
  if (!doc || typeof doc !== 'object' || doc instanceof Date) return doc;

  const result = {};

  for (const [key, value] of Object.entries(doc)) {
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    const fullPath = prefix ? `${prefix}.${key}` : key;
    const type = typeMap[fullPath];

    // ── Known Sub-Document Array ──
    if (type === 'SubDocArray' && Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? castDocument(item, typeMap, fullPath)
          : item
      );
      continue;
    }

    // ── Known Array of typed scalars ──
    if (type && type.startsWith('Array<')) {
      const elementType = type.slice(6, -1); // "ObjectId", "String", …
      result[key] = Array.isArray(value)
        ? value.map((item) => castValue(item, elementType))
        : value;
      continue;
    }

    // ── Mixed — heuristic deep restore ──
    if (type === 'Mixed') {
      result[key] = deepRestoreMixed(value);
      continue;
    }

    // ── Known scalar type ──
    if (type) {
      result[key] = castValue(value, type);
      continue;
    }

    // ── Unknown nested object — recurse to catch known child paths ──
    if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = castDocument(value, typeMap, fullPath);
      continue;
    }

    // ── Unknown array — try document casting on each element ──
    if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === 'object' && item !== null) {
          return castDocument(item, typeMap, fullPath);
        }
        return item;
      });
      continue;
    }

    // ── Fallback: leave as-is ──
    result[key] = value;
  }

  return result;
}

/**
 * Cast an array of documents for a given collection.
 */
function castDocuments(docs, typeMap) {
  return docs.map((doc) => castDocument(doc, typeMap));
}

// ─── Exports ────────────────────────────────────────────────────────

module.exports = {
  extractTypeMap,
  generateAllTypeMaps,
  castValue,
  deepRestoreMixed,
  castDocument,
  castDocuments,
};
