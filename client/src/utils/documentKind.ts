// The upload form accepts PDF, JPG, JPEG and PNG. Storage paths keep the file's extension.
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"];

/** True when a file name, storage path or URL (query string and hash ignored) ends in an image extension. */
export const isImageDocument = (nameOrUrl?: string | null): boolean => {
  if (!nameOrUrl) return false;
  const clean = nameOrUrl.toLowerCase().split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  return dot !== -1 && IMAGE_EXTENSIONS.includes(clean.slice(dot + 1));
};
