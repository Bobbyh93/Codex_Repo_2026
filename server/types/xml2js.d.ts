declare module 'xml2js' {
  export interface ParserOptions {
    explicitArray?: boolean;
    mergeAttrs?: boolean;
    normalize?: boolean;
    normalizeTags?: boolean;
    explicitRoot?: boolean;
    attrkey?: string;
    charkey?: string;
    [key: string]: any;
  }

  export class Parser {
    constructor(options?: ParserOptions);
    parseString(str: string, callback: (err: Error | null, result: any) => void): void;
    parseStringPromise(str: string): Promise<any>;
  }

  export function parseString(str: string, callback: (err: Error | null, result: any) => void): void;
  export function parseString(str: string, options: ParserOptions, callback: (err: Error | null, result: any) => void): void;
}