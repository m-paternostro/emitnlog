import type { Invocation, InvocationAtStage, InvocationStage } from './definition.ts';

type StageType = InvocationStage['type'];

export type AtStage<I extends Invocation, TStageType extends StageType> = I & InvocationAtStage<TStageType>;

export const isAtStage = <I extends Invocation, T extends StageType>(
  invocation: I | undefined,
  stage: T,
): invocation is AtStage<I, T> => invocation?.stage.type === stage;
