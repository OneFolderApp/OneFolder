declare module '*.scss';
declare module '*.svg' {
  import React = require('react');
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}
declare module '*.png' {
  const content: any;
  export default content;
}
declare module '*.jpg' {
  const content: any;
  export default content;
}
declare module '*.gif' {
  const content: any;
  export default content;
}
declare module '*.ico' {
  const content: any;
  export default content;
}
declare module '*.wasm' {
  const content: any;
  export default content;
}
declare module '*?file' {
  const content: string;
  export default content;
}

// Web worker support
declare module 'worker-loader!*' {
  class WebpackWorker extends Worker {
    constructor();
  }

  export default WebpackWorker;
}

declare module '@logion/node-exiftool' {
  /**
   * Custom type definition based on https://www.npmjs.com/package/node-exiftool
   */
  namespace exiftool {
    export interface IMetadata {
      [key: string]: any;
      SourceFile?: string;
      HierarchicalSubject?: string | string[];
      Subject?: string | string[];
      Keywords?: string | string[];

      ExifToolVersion?: number;
      Orientation?: string;
      XResolution?: number;
      YResolution?: number;
      ResolutionUnit?: string;
      YCbCrPositioning?: string;
      XMPToolkit?: string;
      CreatorWorkURL?: string;
      Scene?: string;
      Creator?: string;
      Author?: string;
      ImageSize?: string;
      Megapixels?: number;
    }

    class ExiftoolProcess {
      constructor(exiftoolPath?: string);
      open(options?: { detached?: boolean; env?: any }): Promise<number>;
      close(): Promise<void>;
      _open?: boolean;

      /**
       * Read metadata of one or more files.
       *
       * @param file The path to a file, or `'DIR'` for all files in a directory
       * @param options Which attributes to return. Read everything with `['-File:all']`
       * Or read specific attributes, e.g. `ep.readMetadata('photo.jpg', ['Creator', 'CreatorWorkURL', 'Orientation']`
       * For charset problems, try reading with utf8 by passing in `'charset filename=utf8'`
       *
       */
      readMetadata(
        file: string,
        options?: string[],
      ): Promise<{ data: null | IMetadata[]; error: string | null }>;

      /**
       * You can write metadata with node-exiftool.
       * Note: The returned "error" is also used as confirmation, e.g.
       * `'1 image files updated'`
       * @param file The path to a file
       * @param data For example:
       * ```ts
       * const data = {
       *   all: '', // this removes all metadata at first
       *   comment: 'Exiftool rules!', // has to come after `all` in order not to be removed
       *   'Keywords+': [ 'keywordA', 'keywordB' ],
       *  };
       * ```
       * @param args an array of any other arguments you wish to pass, e.g,. `['overwrite_original']`
       */
      writeMetadata(
        file: string,
        data: IMetadata,
        args?: string[],
      ): Promise<{ data: any | null; error: string | null }>;
    }
  }

  export default exiftool;
}

declare module '@recogito/annotorious' {
  export class Annotorious {
    constructor(options: any);
    //  .addAnnotation
    // .addDrawingTool
    // .cancelSelected
    // .clearAnnotations
    // .clearAuthInfo
    destroy(): void;
    // .getAnnotationById
    getAnnotations(): W3CAnnotation[];
    // .getImageSnippetById
    // .getSelected
    // .getSelectedImageSnippet
    // .listDrawingTools
    // .loadAnnotations
    // .off
    on(eventName: string, callback: (event: any) => void): void;
    // .once
    // .removeAnnotation
    // .removeDrawingTool
    // .saveSelected
    // .selectAnnotation
    setAnnotations(annotations: object): void;
    // .setAuthInfo
    // .setDrawingTool
    // .setServerTime
    // .setVisible
    // .updateSelected
  }

  export class W3CAnnotation {
    '@context': string;
    type: string;
    body: BodyW3CAnnotation;
    target: {
      source: string;
      selector: {
        type: string;
        conformsTo: string;
        value: string;
      };
    };
    id?: string;
  }

  type BodyW3CAnnotation = TextualBody[];
  export class TextualBody {
    type: string;
    value: string;
    purpose: string;
  }
}

type MWGArea = {
  H: number;
  W: number;
  X: number;
  Y: number;
  Unit: string;
};

type MWGRegion = {
  Area: MWGArea;
  Name: string;
  Type: string;
};

type MWGRegionInfo = {
  AppliedToDimensions: {
    H: number;
    Unit: string;
    W: number;
  };
  RegionList: MWGRegion[];
};

type MWGJson = {
  RegionInfo: MWGRegionInfo;
};

declare module 'geo-coordinates-parser';
