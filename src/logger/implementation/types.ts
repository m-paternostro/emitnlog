type Finalizable = { readonly flush?: () => void | Promise<void>; readonly close?: () => void | Promise<void> };

export type Finalizer<T extends Finalizable> = Omit<T, 'close'> & {
  readonly flush: () => void;
  readonly close: () => void;
};

export type AsyncFinalizer<T extends Finalizable> = Omit<T, 'flush' | 'close'> & {
  readonly flush: () => Promise<void>;
  readonly close: () => Promise<void>;
};
