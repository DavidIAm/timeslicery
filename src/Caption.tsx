import EventEmitter from "events";
import { format } from "./Util";
import { v4 } from "uuid";

export interface Caption {
  uuid: string;
  start: number;
  startRaw: string;
  end: number;
  endRaw: string;
  align: string;
  voice: string;
  text: string;
  index?: number;
  backSize?: number;
  foreSize?: number;
}

// export const cloneCaption: (
//   caption: Caption,
//   start: number,
//   end: number
// ) => Caption = (caption, start, end) => {
//   return Object.assign({}, caption, { uuid: v4(), start, end });
// };

export enum PLC {
  PAUSE,
  PLAY,
  ENTRY,
  CUE,
}

export enum CUE_STATE {
  CUE_START,
  CUE_OFF,
  CUE_IN,
  CUE_GAP,
  CUE_SAVE,
  CUE_CANCEL,
}

export type Change = {
  when: Modification[];
};
export type Modification = {
  when: Date;
  previous: Caption;
  next: Caption;
};

export enum MutationActions {
  CLEAR,
  REPLACE,
  ADD,
  DELETE,
  BULK_ADD,
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
            startRaw: format(after?.start),
            endRaw: format(after?.end),
          }),
        }
      : {}),
  };
};

type Options = {
  changes: Mutation[];
  undoneChanges: Mutation[];
  index: { [key: string]: number };
};

export class CaptionFile extends EventEmitter {
  public captions: Caption[];
  public chunks: { [key: number]: Caption[] } = {};
  public changes: Mutation[] = [];

  public undoneChanges: Mutation[] = [];
  private cb: (cf: CaptionFile) => void = () => {};
  private index: { [key: string]: number } = {};
  private uuidString: string = "";

  isEmpty() {
    return (
      !this.captions.length &&
      !this.changes.length &&
      !this.undoneChanges.length
    );
  }

  clone(newCaptions?: Caption[]): CaptionFile {
    if (!newCaptions?.length && this.isEmpty()) return this;
    return new CaptionFile(newCaptions || this.captions, this.cb, {
      undoneChanges: this.undoneChanges,
      changes: this.changes,
      index: this.index,
    });
  }

  constructor(
    captions: Caption[],
    cb?: (cf: CaptionFile) => void,
    options?: Options
  ) {
    super();
    this.captions = captions;
    this.uuid = v4();
    //    if (captions.length === 0) console.trace("what hapepned");
    if (cb) this.cb = cb;
    Object.assign(this, options);
    this.changed();
  }

  set uuid(uuid: string) {
    this.uuidString = uuid;
  }

  get uuid(): string {
    return this.uuidString;
  }

  conform() {
    this.captions = this.captions
      .sort((a, b) => a.start - b.start)
      .flatMap((c, i, a) => (i > 0 && c.uuid === a[i - 1].uuid ? [] : [c]))
      .map((c, i, arr) => {
        c.index = i;
        if (i > 0) {
          const prevEnd = arr[i - 1]?.end || 0;
          if (prevEnd >= c.start) {
            c.start = prevEnd + 0.001;
            c.startRaw = format(c.start);
          }
        }
        if (c.end <= c.start) {
          c.end = c.start + 0.001;
          c.endRaw = format(c.end);
        }
        c.backSize = (c.start - (i ? arr[i - 1].end : 0)) * 1000;
        c.foreSize =
          (arr[Math.min(i + 1, arr.length - 1)].start - c.end) * 1000;
        return c;
      });
  }

  add(captions: Caption[]): void {
    this.captions = [...this.captions, ...captions];
    this.changed();
  }

  modify(mutation: Mutation): CaptionFile {
    if (
      [...this.undoneChanges, ...this.changes].find(
        (m) => m.uuid === mutation.uuid
      )
    ) {
      return this.clone();
    }
    switch (mutation.action) {
      case MutationActions.REPLACE:
        return this.clone_replace(mutation);
      case MutationActions.ADD:
        return this.clone_add(mutation);
      case MutationActions.BULK_ADD:
        return this.clone_bulk_add(mutation);
      case MutationActions.CLEAR:
        return this.clone_clear(mutation);
      case MutationActions.DELETE:
        return this.clone_delete(mutation);
    }
  }

  addChange(mutation: Mutation) {
    // Builder pattern instead?
    this.changes = [...this.changes, mutation];
  }

  clone_add(mutation: Mutation): CaptionFile {
    this.addChange(mutation);
    return this.clone([
      ...this.captions,
      ...(mutation?.after ? [mutation?.after] : []),
    ]);
  }

  clone_clear(mutation: Mutation): CaptionFile {
    if (this.isEmpty()) return this;
    return new CaptionFile([], this.cb);
  }

  clone_delete(mutation: Mutation): CaptionFile {
    this.addChange(mutation);
    return this.clone(
      this.captions.filter((c) => mutation.before?.uuid !== c.uuid)
    );
  }

  clone_bulk_add(mutation: Mutation): CaptionFile {
    this.addChange(mutation);
    return this.clone([...this.captions, ...(mutation?.bulk || [])]);
  }

  clone_replace(mutation: Mutation): CaptionFile {
    console.log("replacing", this.uuid);
    const { before, after } = mutation;
    if (!before?.uuid) throw new Error("mutation before has no uuid");
    if (!after?.uuid) throw new Error("after mutation has no uuid");
    this.addChange(mutation);
    this.captions[this.index[before.uuid]] = after;
    this.emit("indexChange", { before: before.index, after: after.index });
    return this.clone(
      this.captions.map((c) => {
        if (c.uuid !== before.uuid) return c;
        return after;
      })
    );
  }

  redo() {
    const top = this.undoneChanges.pop();
    if (!top) return;
    this.modify(this.flip(top));
  }

  undo() {
    const top = this.changes.pop();
    if (!top) return;
    this.undoneChanges.push(top);
    this.modify(this.flip(top));
  }

  flip(m: Mutation) {
    const { action, when, note, before: after, after: before } = m;

    return makeMutation({ action, when, note, before, after });
  }

  aggregateSpeaker() {
    return this.captions.reduce(
      (acc: { voice: string; text: string }[], { voice, text }: Caption) => {
        const final = acc[acc.length - 1];
        if (!final || final.voice.toUpperCase() !== voice.toUpperCase()) {
          acc.push({ voice, text });
        } else {
          final.text = [final.text, text].join(" ");
        }
        return acc;
      },
      []
    );
  }

  blockIndent(text: string, prefix: string): string {
    const whitespace = Array(prefix.length).join(" ");
    const remaining = 72 - whitespace.length;
    return (
      prefix +
      text
        .split(/\s/)
        .map((value, i, a) => ({
          key: Math.floor(
            a.slice(0, i).reduce((a, v) => a + v.length + 1, 0) / remaining
          ),
          value,
        }))
        .reduce(
          (lines, { key, value }) =>
            (lines[key] = [...(lines[key] || []), value]),
          Array((text.length % remaining) + 2)
        )
        .join(`\n${whitespace}`)
    );
  }

  generateText() {
    this.aggregateSpeaker()
      .map(({ voice, text }) => this.blockIndent(`${voice}: `, text))
      .join("\n\n");
  }

  collectVoices() {
    return new Set(this.captions.map(({ voice }) => voice).sort());
  }

  updateIndex() {
    this.index = Object.fromEntries(
      this.captions.map(({ uuid }, index) => [uuid, index])
    );
  }

  byUuid(uuid: string): Caption {
    console.log("index length", this.index.length);
    if (!(uuid in this.index))
      throw new Error(`uuid ${uuid} is not in the index?`);
    if (!(this.index[uuid] in this.captions))
      throw new Error(`index ${this.index[uuid]} is not in the captions?`);
    return this.captions[this.index[uuid]];
  }

  changed() {
    this.conform();
    this.updateIndex();
    this.emit("captions", this.captions);
    this.emit("text", this.captions);
    this.emit("voices", this.collectVoices());
  }
}
