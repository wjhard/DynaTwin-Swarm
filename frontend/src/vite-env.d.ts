/// <reference types="vite/client" />

declare module "@jiaminghi/data-view-react" {
  import type { ComponentType, ReactNode } from "react";

  type DataViewComponent = ComponentType<Record<string, unknown> & { className?: string; children?: ReactNode }>;

  export const BorderBox1: DataViewComponent;
  export const BorderBox8: DataViewComponent;
  export const BorderBox11: DataViewComponent;
  export const BorderBox12: DataViewComponent;
  export const BorderBox13: DataViewComponent;
  export const Decoration3: DataViewComponent;
  export const Decoration5: DataViewComponent;
  export const Decoration6: DataViewComponent;
  export const DigitalFlop: DataViewComponent;
  export const ScrollBoard: DataViewComponent;
}
