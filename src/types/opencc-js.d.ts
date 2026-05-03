declare module "opencc-js" {
  export interface ConverterOptions {
    from: "cn" | "hk" | "jp" | "tw" | "twp";
    to: "cn" | "hk" | "jp" | "tw" | "twp";
  }

  export function Converter(options: ConverterOptions): (text: string) => string;
}
