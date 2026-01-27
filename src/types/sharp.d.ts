/**
 * Type declarations for optional sharp dependency.
 * Sharp is lazy-loaded at runtime and may not be installed.
 */
declare module 'sharp' {
  interface SharpInstance {
    metadata(): Promise<{ width?: number; height?: number; format?: string }>;
    composite(overlays: Array<{ input: Buffer; top: number; left: number }>): SharpInstance;
    png(): SharpInstance;
    jpeg(): SharpInstance;
    toBuffer(): Promise<Buffer>;
  }

  type Sharp = (input: string | Buffer) => SharpInstance;

  const sharp: Sharp;
  export default sharp;
}
