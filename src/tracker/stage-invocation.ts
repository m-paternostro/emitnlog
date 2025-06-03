import type { Invocation, InvocationAtStage } from './definition.ts';

export const isAtStage = <T extends Invocation['stage']['type']>(
  invocation: Invocation | undefined,
  stage: T,
): invocation is InvocationAtStage<T> => invocation?.stage.type === stage;
