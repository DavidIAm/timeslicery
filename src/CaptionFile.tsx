import EventEmitter from "events";
import { v4 } from "uuid";
import { Caption } from "./Caption";
import {
  CompletedMutation,
  makeMutation,
  Mutation,
  MutationActions,
} from "./Mutation";
import { CaptionSet } from "./CaptionSet";

const defaultChanges: CompletedMutation[] = [
  Object.assign(
    { dependents: [], captionSet: new CaptionSet([]) },
    makeMutation({ action: MutationActions.CLEAR, note: "app init" })
  ),
];

export class CaptionFile extends EventEmitter {
  public chunks: { [key: number]: Caption[] } = {};
  public changes: CompletedMutation[] = [];

  public undoneChanges: CompletedMutation[] = [];
  private index: { [key: string]: number } = {};
  private uuidString: string = "";

  constructor(
    changes: CompletedMutation[] = defaultChanges,
    undoneChanges: CompletedMutation[] = []
  ) {
    super();
    this.uuid = v4();
    this.changes = [...changes];
    this.undoneChanges = [...undoneChanges];
  }

  get captionSet(): CaptionSet {
    return this.changes[this.changes.length - 1]?.captionSet;
  }

  set uuid(uuid: string) {
    this.uuidString = uuid;
  }

  get uuid(): string {
    return this.uuidString;
  }

  redo() {
    const top = this.undoneChanges.pop();
    if (!top) return;
    // test this
    //applyChanges(this.flip(top));
    throw new Error("unimplemented");
  }

  undo() {
    const top = this.changes.pop();
    if (!top) return;
    this.undoneChanges.push(top);
    throw new Error("unimplemented");
  }

  flip(m: Mutation) {
    const { action, when, note, before: after, after: before } = m;

    return makeMutation({ action, when, note, before, after });
  }

  get captions(): Caption[] {
    return this.captionSet.getCaptions();
  }

  aggregateSpeaker() {
    return this.captions.reduce(
      (acc: { voice: string; text: string }[], { voice, text }: Caption) => {
        const final = acc[acc.length - 1];
        if (
          voice &&
          (!final || final.voice.toUpperCase() !== voice.toUpperCase())
        ) {
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

  changed() {
    this.emit("captions", this.captions);
    this.emit("text", this.captions);
    this.emit("voices", this.collectVoices());
  }

  applyMutation(mutation: Mutation) {
    if (this.changes.find((m) => m.uuid === mutation.uuid))
      return new CaptionFile(this.changes, this.undoneChanges);
    const complete = CaptionSet.completeMutation(mutation, this.captionSet);
    this.changes.push(complete);
    return new CaptionFile(this.changes, this.undoneChanges);
  }

  byUuid(uuid: string): Promise<Caption> {
    return this.captionSet.byUuid(uuid);
  }
}
