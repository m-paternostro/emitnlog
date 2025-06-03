import type { Invocation, InvocationAtStage, InvocationStage } from './definition.ts';

export const isAtStage = <T extends InvocationStage['type']>(
  invocation: Invocation | undefined,
  stage: T,
): invocation is InvocationAtStage<T> => invocation?.stage.type === stage;
