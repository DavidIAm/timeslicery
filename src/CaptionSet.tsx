import { format } from "./Util";
import { Caption } from "./Caption";
import {
  CompletedMutation,
  DependedMutation,
  makeMutation,
  Mutation,
  MutationActions,
} from "./Mutation";
import { v4 } from "uuid";

export class CaptionSet {
  private readonly captions: Caption[];

  constructor(initCaptions: Caption[]) {
    this.captions = initCaptions;
  }

  // constructor(changes: CompletedMutation[], initCaptions?: Caption[]) {
  //   const start = Date.now();
  // }
  //
  // clone(): CaptionSet {
  //   return new CaptionSet([], [...this.captions.map((c) => ({ ...c }))]);
  // }
  //
  getCaptions(): Caption[] {
    return this.captions;
  }

  //
  // applyMutations(changes: CompletedMutation[]): CaptionSet {
  //   return new CaptionSet(changes, this.captions);
  // }
  //
  byUuid(uuid: string): Promise<Caption> {
    return new Promise<Caption>((resolve, reject) => {
      const c = this.captions.find((c) => c.uuid === uuid);
      if (c) resolve(c);
      reject(new Error(`uuid not found ${uuid}`));
    });
  }

  //
  // completeMutation(mutation: Mutation): CompletedMutation {
  //   return CaptionSet.completeMutation(mutation, this.captions);
  // }

  static startPrevMod(current: Caption, prev?: Caption): Partial<Caption> {
    const start =
      prev && prev.end >= current.start ? prev.end + 0.001 : current.start;
    const startRaw = format(start);
    return { start, startRaw };
  }

  static metaEndFields(current: Caption, next?: Caption) {
    const endRaw = format(current.end);
    const nextCaption = next;
    // predict the gap will be 0.001 if next start is negative offset
    const foreSize =
      Math.max(((next && next.start) || current.end) - current.end, 0.001) *
      1000;
    return { endRaw, nextCaption, foreSize };
  }

  static metaStartFields(current: Caption, prev?: Caption) {
    const startRaw = format(current.start);
    const prevCaption = prev;
    const backSize = (current.start - ((prev && prev.end) || 0)) * 1000;
    return { startRaw, prevCaption, backSize };
  }

  static metaUpdate(captions: Caption[]): Caption[] {
    return captions
      .sort((a, b) => a.start - b.start)
      .map(
        (c, i, arr) =>
          Object.assign(
            c,
            { index: i },
            CaptionSet.metaStartFields(c, i > 0 ? arr[i - 1] : void 0),
            CaptionSet.metaEndFields(
              c,
              i + 1 < arr.length ? arr[i + 1] : void 0
            )
          ) as Caption
      );
  }

  static conform(captions: Caption[]): Mutation[] {
    return (
      captions
        .sort((a, b) => a.start - b.start)
        //.flatMap((c, i, a) => (i > 0 && c.uuid === a[i - 1].uuid ? [] : [c])) // DEDUPLICATE
        .map((c, i, arr) => ({
          before: c,
          after: Object.assign(
            { uuid: v4() },
            c,
            CaptionSet.startPrevMod(c, i > 0 ? arr[i - 1] : void 0)
          ) as Caption,
        }))
        .filter(({ before, after }) => !Caption.equals(before, after))
        .map(({ before, after }) => {
          return makeMutation({
            action: MutationActions.REPLACE,
            note: "conformation adjust",
            before,
            after,
          });
        })
    );
  }

  static completeMutation(
    mutation: Mutation,
    captionSet: CaptionSet = new CaptionSet([])
  ): CompletedMutation {
    const cloned = [...captionSet.getCaptions().map((c) => ({ ...c }))];
    const dependents = Object.assign(mutation, {
      dependents: CaptionSet.getDependents(mutation, cloned),
    });

    return Object.assign(dependents, {
      captionSet: CaptionSet.applyChanges([dependents], cloned),
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

  static applyChanges(
    changes: DependedMutation[],
    initCaptions: Caption[] = []
  ): CaptionSet {
    return new CaptionSet(
      CaptionSet.metaUpdate(
        changes
          .flatMap((m) => [m, ...(m.dependents || [])])
          .reduce<Caption[]>(
            (cf, mutation: Mutation): Caption[] =>
              CaptionSet.applyMutation(mutation, cf),
            initCaptions
          )
      )
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
