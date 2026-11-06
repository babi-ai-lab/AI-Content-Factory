export type ZipStoreEntry = {
  name: string;
  data: Uint8Array | ArrayBuffer;
};
export function createZipStore(entries: readonly ZipStoreEntry[]): Uint8Array;
