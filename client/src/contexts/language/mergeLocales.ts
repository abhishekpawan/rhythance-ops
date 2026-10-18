// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isObject(item: any): item is Record<string, any> {
  return item && typeof item === "object" && !Array.isArray(item);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    for (const key of Object.keys(source)) {
      if (isObject(source[key])) {
        if (!(key in target) || !isObject(target[key])) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    }
  }
  return output;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeLocale(
  core: Record<string, any>,
  ...modules: Record<string, any>[]
): Record<string, any> {
  return modules.reduce((acc, mod) => deepMerge(acc, mod), core);
}
