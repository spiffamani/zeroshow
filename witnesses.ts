export type ZeroshowPrivateState = { completedTasks: bigint };

export const witnesses = {
  completedTasks: (context: { privateState: ZeroshowPrivateState }): [ZeroshowPrivateState, bigint] =>
    [context.privateState, context.privateState.completedTasks],
};
