import { v4 } from "uuid";
import { format } from "./Util";
import { Caption } from "./Caption";

export enum MutationActions {
  CLEAR,
  REPLACE,
  ADD,
  DELETE,
  BULK_ADD,
}

export type CompletedMutation<T, S> = Mutation<T> &
  WithDependents<T> &
  WithSet<S>;
export type DependedMutation<T> = Mutation<T> & WithDependents<T>;
export interface WithSet<S> {
  set: S;
}
export interface WithDependents<T> {
  dependents: Mutation<T>[];
}
export interface Mutation<T> {
  action: MutationActions;
  uuid: string;
  when: Date;
  note: string;
  before?: T;
  after?: T;
  bulk?: T[];
  DEPENDENT?: Boolean;
}

export const mutateCaption: (
  m: Partial<Mutation<Caption>>
) => Mutation<Caption> = ({ action, note, bulk, before, after }) => {
  if (typeof action === "undefined")
    throw new Error("Mutation requires action");
  if (!note) throw new Error("Mutation requires note");
  return {
    action,
    uuid: v4(),
    when: new Date(),
    note,
    bulk,
    before,
    ...(after
      ? {
          after: Object.assign(after, {
            startRaw: format(after?.start || 0),
            endRaw: format(after?.end || 0),
          }),
        }
      : {}),
  };
};
