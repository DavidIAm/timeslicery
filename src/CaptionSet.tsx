import { format } from "./Util";
import { Caption } from "./Caption";
import {
  CompletedMutation,
  DependedMutation,
  mutateCaption,
  Mutation,
  MutationActions,
  ReplaceMutation,
} from "./Mutation";
import { v4 } from "uuid";

export class CaptionSet {
  private readonly captions: Caption[];
  private metaCaptions: Caption[] | undefined;

  constructor(initCaptions: Caption[]) {
    this.captions = initCaptions;
  }

  getCaptionsNoMeta(): Caption[] {
    return this.captions;
  }
  getCaptions(): Caption[] {
    // TODO: Cache this?
    this.metaCaptions =
      this.metaCaptions || CaptionSet.metaUpdate([...this.captions]);
    return this.metaCaptions;
  }

  byUuid(uuid: string): Promise<Caption> {
    return new Promise<Caption>((resolve, reject) => {
      const c = this.captions.find((c) => c.uuid === uuid);
      if (c) resolve(c);
      reject(new Error(`uuid not found ${uuid}`));
    });
  }

  static startEndMod(current: Caption, next?: Caption): Partial<Caption> {
    if (next && !next?.AUTHORITATIVE) return {};
    const end =
      next && next.start < current.end ? next.start - 0.001 : current.end;
    return { end };
  }

  static startPrevMod(current: Caption, prev?: Caption): Partial<Caption> {
    if (current.AUTHORITATIVE) return {};
    const start =
      prev && prev.end >= current.start ? prev.end + 0.001 : current.start;
    return { start };
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
    captions.forEach(
      (c, i, arr) =>
        Object.assign(
          c,
          { index: i },
          CaptionSet.metaStartFields(c, i > 0 ? arr[i - 1] : void 0),
          CaptionSet.metaEndFields(c, i + 1 < arr.length ? arr[i + 1] : void 0)
        ) as Caption
    );
    return captions;
  }

  // apply( captionset, conform( (USERmutation + captionset) => incomplete Captionset ) => [mutations to conform]) => conformed captionset
  static conform(captions: Caption[]): Mutation<Caption>[] {
    return captions
      .map((c, i, arr) => ({
        before: c,
        after: Caption.clone(
          Object.assign(
            { uuid: v4() },
            c,
            CaptionSet.startPrevMod(c, i > 0 ? arr[i - 1] : void 0),
            CaptionSet.startEndMod(c, i + 2 < arr.length ? arr[i + 1] : void 0)
          ) as Caption
        ),
      }))
      .filter(({ before, after }) => !Caption.equals(before, after))
      .map(({ before, after }) => {
        // Maybe this should happen on the next copy of the caption list instead of here...
        //delete after.AUTHORITATIVE;
        return mutateCaption({
          action: MutationActions.REPLACE,
          note: "conformation adjust",
          before,
          after,
          DEPENDENT: true,
        });
      });
  }

  static completeMutation(
    mutation: Mutation<Caption>,
    captionSet: CaptionSet = new CaptionSet([])
  ): CompletedMutation<Caption, CaptionSet> {
    const captions = captionSet.getCaptionsNoMeta();
    const dependedMutation = Object.assign(mutation, {
      dependents: CaptionSet.getDependents(mutation, captions),
    });

    return Object.assign(dependedMutation, {
      set: CaptionSet.applyChanges([dependedMutation], captions),
    });
  }

  static getDependents(
    mutation: Mutation<Caption>,
    captions: Caption[]
  ): Mutation<Caption>[] {
    return CaptionSet.conform(CaptionSet.applyMutation(mutation, captions));
  }

  static applyMutation(
    mutation: Mutation<Caption>,
    captions: Caption[]
  ): Caption[] {
    switch (mutation.action) {
      case MutationActions.REPLACE:
        const { before, after } = mutation;
        if (!before) throw new Error("Replace Mutations must have before");
        if (!after) throw new Error("Replace Mutations must have after");
        return CaptionSet.mutate_replace(
          { ...mutation, before, after },
          captions
        );
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
    changes: DependedMutation<Caption>[],
    initCaptions: Caption[] = []
  ): CaptionSet {
    return new CaptionSet(
      changes
        .flatMap((m) => [m, ...(m.dependents || [])])
        .reduce<Caption[]>((cf, mutation: Mutation<Caption>): Caption[] => {
          const out = CaptionSet.applyMutation(mutation, cf);
          return out;
        }, initCaptions)
    );
  }

  static mutate_add(
    mutation: Mutation<Caption>,
    captions: Caption[]
  ): Caption[] {
    return [...captions, ...(mutation.after ? [mutation.after] : [])].sort(
      (a, b) => a.start - b.start
    );
  }

  static mutate_clear(): Caption[] {
    return [];
  }

  static mutate_delete(
    mutation: Mutation<Caption>,
    captions: Caption[]
  ): Caption[] {
    return captions.filter((c) => mutation.before?.uuid !== c.uuid);
  }

  static mutate_bulk_add(
    mutation: Mutation<Caption>,
    captions: Caption[]
  ): Caption[] {
    return [...captions, ...(mutation.bulk || [])].sort(
      (a, b) => a.start - b.start
    );
  }

  static mutate_replace(
    mutation: ReplaceMutation<Caption>,
    captions: Caption[]
  ): Caption[] {
    return captions.map((caption) =>
      caption.uuid === mutation.before.uuid ? mutation.after : caption
    );
  }
}
