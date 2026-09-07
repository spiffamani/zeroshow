export type ZeroshowPrivateState = {
  completedTasks: bigint;
};

export const witnesses = {
  completedTasks: (context: { privateState: ZeroshowPrivateState }) =>
    [context.privateState, context.privateState.completedTasks] as const,
};
