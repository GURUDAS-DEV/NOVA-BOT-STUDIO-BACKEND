type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type SanitizedAPIResult = {
  meta: {
    detectedShape: string;
    primaryKey: string | null;
    totalItems: number | null;
  };
  schema: Record<string, string>;
  aggregates: Record<string, any>;
  samples: Record<string, any>[];
  notes: string[];
};

const LIMITS = {
  MAX_SAMPLES: 2,
  MAX_KEYS: 20,
  MAX_STRING_LENGTH: 200,
  MAX_DEPTH: 3
};

/* ---------------- HELPERS ---------------- */

function getType(value: any): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function truncateString(str: string): string {
  return str.length > LIMITS.MAX_STRING_LENGTH
    ? str.slice(0, LIMITS.MAX_STRING_LENGTH) + "…"
    : str;
}

function sanitizePrimitive(value: any): any {
  if (typeof value === "string") return truncateString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  return null;
}

function extractSchema(obj: any): Record<string, string> {
  const schema: Record<string, string> = {};
  Object.keys(obj)
    .slice(0, LIMITS.MAX_KEYS)
    .forEach((key) => {
      schema[key] = getType(obj[key]);
    });
  return schema;
}

/* ------------- CORE LOGIC ---------------- */

function findPrimaryArray(data: any): { key: string | null; array: any[] | null } {
  if (Array.isArray(data)) {
    return { key: null, array: data };
  }

  if (typeof data === "object" && data !== null) {
    let maxLen = 0;
    let selectedKey: string | null = null;
    let selectedArray: any[] | null = null;

    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key].length > maxLen) {
        maxLen = data[key].length;
        selectedKey = key;
        selectedArray = data[key];
      }
    }

    return { key: selectedKey, array: selectedArray };
  }

  return { key: null, array: null };
}

function computeAggregates(items: any[]): Record<string, any> {
  const aggregates: Record<string, any> = {
    total_items: items.length
  };

  const numericFields: Record<string, number[]> = {};

  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;

    for (const key of Object.keys(item)) {
      if (typeof item[key] === "number") {
        numericFields[key] ??= [];
        numericFields[key].push(item[key]);
      }
    }
  }

  for (const key in numericFields) {
    const values = numericFields[key];
    if (!values || values.length === 0) continue;
    aggregates[key] = {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
    };
  }

  return aggregates;
}

function pickSamples(items: any[]): any[] {
  if (items.length <= LIMITS.MAX_SAMPLES) {
    return items;
  }

  const samples: any[] = [];

  samples.push(items[0]); // first
  samples.push(items[Math.floor(items.length / 2)]); // middle
  samples.push(items[items.length - 1]); // last

  while (samples.length < LIMITS.MAX_SAMPLES) {
    const randomIndex = Math.floor(Math.random() * items.length);
    samples.push(items[randomIndex]);
  }

  return samples.slice(0, LIMITS.MAX_SAMPLES);
}

function sanitizeObject(obj: any, depth = 0): any {
  if (depth > LIMITS.MAX_DEPTH) return null;

  if (typeof obj !== "object" || obj === null) {
    return sanitizePrimitive(obj);
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, LIMITS.MAX_SAMPLES).map((v) => sanitizeObject(v, depth + 1));
  }

  const sanitized: any = {};
  Object.keys(obj)
    .slice(0, LIMITS.MAX_KEYS)
    .forEach((key) => {
      sanitized[key] = sanitizeObject(obj[key], depth + 1);
    });

  return sanitized;
}

/* ---------------- MAIN ---------------- */

export function sanitizeAPIResponse(apiResponse: JsonValue): SanitizedAPIResult {
  const notes: string[] = [];

  const { key: primaryKey, array } = findPrimaryArray(apiResponse);

  if (!array) {
    notes.push("No primary array found. Treating response as single object.");
    return {
      meta: {
        detectedShape: "SINGLE_OBJECT",
        primaryKey: null,
        totalItems: null
      },
      schema:
        typeof apiResponse === "object" && apiResponse !== null
          ? extractSchema(apiResponse)
          : {},
      aggregates: {},
      samples: [sanitizeObject(apiResponse)],
      notes
    };
  }

  notes.push(`Primary dataset detected: ${primaryKey ?? "root array"}`);

  const schema = extractSchema(array[0] ?? {});
  const aggregates = computeAggregates(array);
  const samples = pickSamples(array).map((item) => sanitizeObject(item));

  return {
    meta: {
      detectedShape: primaryKey ? "OBJECT_WITH_ARRAY" : "ARRAY",
      primaryKey,
      totalItems: array.length
    },
    schema,
    aggregates,
    samples,
    notes
  };
}
