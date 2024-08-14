declare module 'libheif-js' {
  export class HeifDecoder {
    decode(data: ArrayBuffer | Uint8Array): HeifImage[];
  }

  export class HeifImage {
    get_width(): number;
    get_height(): number;
    display(
      target: { data: Uint8ClampedArray; width: number; height: number },
      callback: (data: Uint8ClampedArray | null) => void,
    ): void;
  }
}
