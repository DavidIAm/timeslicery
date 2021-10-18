import { CaptionFile } from "./CaptionFile";
import { CaptionSet } from "./CaptionSet";
import { mutateCaption, MutationActions } from "./Mutation";
import { v4 } from "uuid";

describe("CaptionFile", () => {
  test("exists", () => {
    expect(new CaptionFile()).toBeTruthy();
  });

  test("has a captionSet", () => {
    expect(new CaptionFile().captionSet).toBeInstanceOf(CaptionSet);
  });

  test("has an empty captionSet", () => {
    expect(new CaptionFile().captionSet.getCaptions()).toHaveLength(0);
  });

  test("to have changes", () => {
    expect(new CaptionFile().changes).toHaveLength(1);
  });

  test("to have more changes", () => {
    const changed = new CaptionFile().applyMutation(
      mutateCaption({
        action: MutationActions.ADD,
        note: "TEST",
        after: {
          uuid: v4(),
          start: 0,
          end: 1,
          text: "TEEST",
          align: "TEEEEST",
        },
      })
    );
    expect(changed.captionSet.getCaptions()).toHaveLength(1);
    expect(changed.changes.map((m) => m.note)).toContain("TEST");
  });
});
