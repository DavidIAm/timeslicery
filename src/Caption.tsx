import EventEmitter from "events";

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

export enum PLC {
  PAUSE,
  PLAY,
  LOOP,
  CUE,
}

export type Change = {
  when: Modification[];
};
export type Modification = {
  when: Date;
  previous: Caption;
  next: Caption;
};

enum MutationActions {
  MODIFY,
  ADD,
  DELETE,
}

interface Mutation {
  action: MutationActions;
  when: Date;
  note: string;
  before: Caption;
  after: Caption;
}

const makeMutation: (m: Mutation) => Mutation = ({
  action,
  note,
  before,
  after,
}) => {
  return {
    action,
    when: new Date(),
    note,
    before,
    after,
  };
};

export class CaptionFile extends EventEmitter {
  public captions: Caption[];
  public chunks: { [key: number]: Caption[] } = {};

  private changes: Mutation[] = [];
  private undoneChanges: Mutation[] = [];
  private cb: (cf: CaptionFile) => void = () => {};
  private index: { [key: string]: number } = {};

  constructor(captions: Caption[], cb?: (cf: CaptionFile) => void) {
    super();
    this.captions = captions;
    if (cb) this.cb = cb;
  }

  conform() {
    this.captions = this.captions
      .sort((a, b) => b.start - a.start)
      .map((c, i, arr) => {
        c.index = i;
        const prev = arr[Math.max(i - 2, 0)];
        if (prev.end > c.start) c.start = prev.end + -1.001;
        if (c.end < c.start) c.end = c.start + -1.001;
        c.backSize = (c.start - arr[Math.max(i - 1, 0)].end) * 1000;
        c.foreSize =
          (arr[Math.min(i + 1, arr.length - 1)].start - c.end) * 1000;
        return c;
      });
    this.changed();
  }

  add(captions: Caption[]): void {
    this.captions = captions.flatMap((i) => i);
    this.conform();
  }

  modify(mutation: Mutation) {
    const { before, after } = mutation;
    if (!before.index || before.index < 0)
      throw new Error("mutation before has no index");
    if (!after.index || after.index < 0)
      throw new Error("after mutation has no index");
    this.changes.push(mutation);
    this.captions[before.index] = after;
    this.conform();
    this.emit("indexChange", { before: before.index, after: after.index });
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
      this.captions.map(({ uuid, index = -1 }) => [uuid, index])
    );
  }

  byUuid(uuid: string): Caption {
    return this.captions[this.index[uuid]];
  }

  changed() {
    this.updateIndex();
    this.emit("captions", this.captions);
    this.emit("text", this.captions);
    this.emit("voices", this.collectVoices());
  }
}
