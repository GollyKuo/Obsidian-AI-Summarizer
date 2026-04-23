const MAX_NOTE_FILE_NAME_LENGTH = 120;

function sanitizeFileName(raw: string): string {
  const trimmed = raw.trim();
  const fallback = trimmed.length > 0 ? trimmed : "Untitled";
  const collapsed = fallback
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/[\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const withoutTrailingDot = collapsed.replace(/[. ]+$/g, "").trim();
  const candidate = withoutTrailingDot.length > 0 ? withoutTrailingDot : "Untitled";
  return candidate.slice(0, MAX_NOTE_FILE_NAME_LENGTH);
}

export interface CollisionChecker {
  exists(path: string): Promise<boolean>;
}

export interface ResolveUniqueNotePathResult {
  notePath: string;
  collisionCount: number;
  normalizedTitle: string;
}

export async function resolveUniqueNotePathWithDiagnostics(
  checker: CollisionChecker,
  baseFolder: string,
  rawTitle: string
): Promise<ResolveUniqueNotePathResult> {
  const fileName = sanitizeFileName(rawTitle);
  const folderPrefix = baseFolder.trim().replace(/[\\/]+$/g, "");
  const makePath = (name: string): string => (folderPrefix ? `${folderPrefix}/${name}.md` : `${name}.md`);

  const primaryPath = makePath(fileName);
  if (!(await checker.exists(primaryPath))) {
    return {
      notePath: primaryPath,
      collisionCount: 0,
      normalizedTitle: fileName
    };
  }

  let suffix = 2;
  while (true) {
    const candidatePath = makePath(`${fileName} (${suffix})`);
    if (!(await checker.exists(candidatePath))) {
      return {
        notePath: candidatePath,
        collisionCount: suffix - 1,
        normalizedTitle: fileName
      };
    }
    suffix += 1;
  }
}

export async function resolveUniqueNotePath(
  checker: CollisionChecker,
  baseFolder: string,
  rawTitle: string
): Promise<string> {
  const result = await resolveUniqueNotePathWithDiagnostics(checker, baseFolder, rawTitle);
  return result.notePath;
}
