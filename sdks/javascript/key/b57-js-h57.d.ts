declare module "@aco/b57-js/h57.js" {
  export const H57Length: {
    readonly HASH_AUTO: number;
  };

  export function h57Hash(input: Uint8Array, length?: number): string;
  export function h57IsValid(value: string): boolean;
  export function h57IsCanonical(value: string): boolean;
}
