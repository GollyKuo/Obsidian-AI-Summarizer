function sanitizeFileName(raw: string): string {
  const trimmed = raw.trim();
  const fallback = trimmed.length > 0 ? trimmed : "Untitled";
  return fallback.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
}

export interface CollisionChecker {
  exists(path: string): Promise<boolean>;
}

export async function resolveUniqueNotePath(
  checker: CollisionChecker,
  baseFolder: string,
  rawTitle: string
): Promise<string> {
  const fileName = sanitizeFileName(rawTitle);
  const folderPrefix = baseFolder.trim().replace(/[\\/]+$/g, "");
  const makePath = (name: string): string => (folderPrefix ? `${folderPrefix}/${name}.md` : `${name}.md`);

  const primaryPath = makePath(fileName);
  if (!(await checker.exists(primaryPath))) {
    return primaryPath;
  }

  let suffix = 2;
  while (true) {
    const candidatePath = makePath(`${fileName} (${suffix})`);
    if (!(await checker.exists(candidatePath))) {
      return candidatePath;
    }
    suffix += 1;
  }
}
