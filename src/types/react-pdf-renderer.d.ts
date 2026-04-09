declare module '@react-pdf/renderer' {
  // Minimal ambient types to satisfy the TypeScript compiler.
  // For full typing, replace with proper types from the library when available.
  import * as React from 'react';

  export const Document: React.ComponentType<any>;
  export const Page: React.ComponentType<any>;
  export const Text: React.ComponentType<any>;
  export const View: React.ComponentType<any>;
  export const Image: React.ComponentType<any>;
  export const PDFViewer: React.ComponentType<any>;
  export const StyleSheet: {
    create<T extends { [key: string]: any }>(styles: T): T;
  };
}
