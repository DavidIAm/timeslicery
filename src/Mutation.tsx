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

export type CompletedMutation = Mutation & WithDependents;
export interface WithDependents {
  dependents: Mutation[];
}
export interface Mutation {
  action: MutationActions;
  uuid: string;
  when: Date;
  note: string;
  before?: Caption;
  after?: Caption;
  bulk?: Caption[];
}

export const makeMutation: (m: Partial<Mutation>) => Mutation = ({
  action,
  note,
  bulk,
  before,
  after,
}) => {
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
