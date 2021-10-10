import { format } from "./Util";
import { Caption } from "./Caption";
import { CaptionFile } from "./CaptionFile";
import {
  CompletedMutation,
  makeMutation,
  Mutation,
  MutationActions,
} from "./Mutation";

export class CaptionSet {
  private readonly captions: Caption[];
  private readonly changes: CompletedMutation[];

  constructor(changes: CompletedMutation[]) {
    this.captions = CaptionSet.applyChanges(changes);
    this.changes = changes;
  }

  getCaptions(): Caption[] {
    return this.captions;
  }

  applyMutations(changes: Mutation[]): CaptionSet {
    return new CaptionSet([
      ...this.changes,
      ...changes.map((mutation) =>
        CaptionSet.completeMutation(mutation, this.captions)
      ),
    ]);
  }

  byUuid(uuid: string): Promise<Caption> {
    return new Promise<Caption>((resolve, reject) => {
      const c = this.captions.find((c) => c.uuid === uuid);
      if (c) resolve(c);
      reject(new Error(`uuid not found ${uuid}`));
    });
  }

  static startPrevMod(current: Caption, prev?: Caption): Partial<Caption> {
    const start =
      prev && prev.end >= current.start ? prev.end + 0.001 : current.start;
    const startRaw = format(start);
    const prevCaption = prev && prev.uuid;
    const backSize = (start - ((prev && prev.end) || 0)) * 1000;
    return { start, startRaw, prevCaption, backSize };
  }

  static endMod(current: Caption, next?: Caption): Partial<Caption> {
    const endRaw = format(current.end);
    const nextCaption = next && next.uuid;
    // predict the gap will be 0.001 if next start is negative offset
    const foreSize =
      Math.max(((next && next.start) || current.end) - current.end, 0.001) *
      1000;
    return { endRaw, nextCaption, foreSize };
  }

  static conform(captions: Caption[]): Mutation[] {
    return (
      captions
        .sort((a, b) => a.start - b.start)
        //.flatMap((c, i, a) => (i > 0 && c.uuid === a[i - 1].uuid ? [] : [c])) // DEDUPLICATE
        .map((c, i, arr) =>
          makeMutation({
            action: MutationActions.REPLACE,
            before: c,
            note: "conformation adjust",
            after: Object.assign(
              {},
              c,
              { index: i },
              CaptionSet.startPrevMod(c, i > 0 ? arr[i - 1] : void 0),
              CaptionSet.endMod(c, i + 1 < arr.length ? arr[i + 1] : void 0)
            ),
          })
        )
    );
  }

  static newCaptionFile(changes: CompletedMutation[]): CaptionFile {
    return new CaptionFile(changes);
  }

  static completeMutation(
    mutation: Mutation,
    captions: Caption[]
  ): CompletedMutation {
    return Object.assign(mutation, {
      dependents: CaptionSet.getDependents(mutation, captions),
    });
  }

  static getDependents(mutation: Mutation, captions: Caption[]): Mutation[] {
    return CaptionSet.conform(CaptionSet.applyMutation(mutation, captions));
  }

  static applyMutation(mutation: Mutation, captions: Caption[]): Caption[] {
    switch (mutation.action) {
      case MutationActions.REPLACE:
        return CaptionSet.mutate_replace(mutation, captions);
      case MutationActions.ADD:
        return CaptionSet.mutate_add(mutation, captions);
      case MutationActions.BULK_ADD:
        return CaptionSet.mutate_bulk_add(mutation, captions);
      case MutationActions.CLEAR:
        return CaptionSet.mutate_clear();
      case MutationActions.DELETE:
        return CaptionSet.mutate_delete(mutation, captions);
      default:
        throw new Error(
          `I don't know what mutation action this is: ${mutation.action}`
        );
    }
  }

  static applyChanges(changes: CompletedMutation[]) {
    return changes
      .flatMap((m) => [m, ...(m.dependents || [])])
      .reduce<Caption[]>(
        (cf, mutation: Mutation): Caption[] =>
          CaptionSet.applyMutation(mutation, cf),
        []
      );
  }

  static mutate_add(mutation: Mutation, captions: Caption[]): Caption[] {
    return [...captions, ...(mutation.after ? [mutation.after] : [])].sort(
      (a, b) => a.start - b.start
    );
  }

  static mutate_clear(): Caption[] {
    return [];
  }

  static mutate_delete(mutation: Mutation, captions: Caption[]): Caption[] {
    return captions.filter((c) => mutation.before?.uuid !== c.uuid);
  }

  static mutate_bulk_add(mutation: Mutation, captions: Caption[]): Caption[] {
    return [...captions, ...(mutation.bulk || [])].sort(
      (a, b) => a.start - b.start
    );
  }

  static mutate_replace(mutation: Mutation, captions: Caption[]): Caption[] {
    return [
      ...captions.filter((caption) => caption.uuid !== mutation.before?.uuid),
      ...(mutation.after ? [mutation.after] : []),
    ].sort((a, b) => a.start - b.start);
  }
}
