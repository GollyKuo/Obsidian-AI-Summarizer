import * as OpenCC from "opencc-js";

const convertSimplifiedToTaiwanTraditional = OpenCC.Converter({
  from: "cn",
  to: "twp"
});

export interface TextNormalizationResult {
  value: string;
  changed: boolean;
}

export function normalizeToTraditionalChinese(value: string): TextNormalizationResult {
  const converted = convertSimplifiedToTaiwanTraditional(value);
  return {
    value: converted,
    changed: converted !== value
  };
}
