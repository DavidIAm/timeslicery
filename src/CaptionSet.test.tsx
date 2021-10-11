import { makeMutation, MutationActions } from "./Mutation";
import { v4 } from "uuid";
import { format } from "./Util";
import { CaptionSet } from "./CaptionSet";

const yay = {
  start: 0,
  end: 1,
  text: "yay",
  uuid: v4(),
  startRaw: format(0),
  endRaw: format(1),
  align: "",
  voice: "",
};
const woof = {
  start: 2,
  end: 3,
  text: "woof",
  uuid: v4(),
  startRaw: format(2),
  endRaw: format(3),
  align: "",
  voice: "",
};
const bark = Object.assign({}, woof, {
  uuid: v4(),
  text: "bark",
  start: 0.5,
  end: 2.5,
});
describe("CaptionSet", () => {
  describe("CaptionSetMutationEvents", () => {
    test("CaptionSets can be empty", () => {
      const underTest = CaptionSet.applyChanges([]);
      expect(underTest.getCaptions()).toHaveLength(0);
    });

    test("CaptionSets can have an element", () => {
      const underTest = CaptionSet.applyChanges([
        CaptionSet.completeMutation(
          makeMutation({
            action: MutationActions.ADD,
            note: "yay",
            after: {
              start: 0,
              end: 1,
              text: "yay",
              uuid: v4(),
              endRaw: format(1),
              startRaw: format(0),
              align: "",
              voice: "",
            },
          }),
          CaptionSet.applyChanges([])
        ),
      ]);
      expect(underTest.getCaptions()).toHaveLength(1);
    });

    test("CaptionSets can bulk load elements", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [yay, woof],
        })
      ).captionSet;
      expect(underTest.getCaptions()).toHaveLength(2);
      expect(
        underTest.getCaptions().find((c) => woof.uuid === c.uuid)
      ).toBeDefined();
      expect(
        CaptionSet.completeMutation(
          makeMutation({
            action: MutationActions.BULK_ADD,
            note: "bork?",
            bulk: [bark],
          }),
          underTest
        ).captionSet.getCaptions()
      ).toHaveLength(3);
    });

    test("CaptionSets can delete elements", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [yay, woof],
        })
      ).captionSet;
      const deleteMutation = makeMutation({
        action: MutationActions.DELETE,
        note: "yay",
        before: yay,
      });
      expect(underTest.getCaptions()).toHaveLength(2);
      expect(
        CaptionSet.completeMutation(deleteMutation, underTest)
          .captionSet.getCaptions()
          .find(() => true)?.uuid
      ).toBe(woof.uuid);
      expect(
        CaptionSet.completeMutation(deleteMutation, underTest)
          .captionSet.getCaptions()
          .find(() => true)?.uuid
      ).not.toBe(yay.uuid);
    });

    test("CaptionSets can clear all", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [yay, woof],
        })
      ).captionSet;
      const clearMutation = makeMutation({
        action: MutationActions.CLEAR,
        note: "yay",
      });
      expect(underTest.getCaptions()).toHaveLength(2);
      expect(
        CaptionSet.completeMutation(
          clearMutation,
          underTest
        ).captionSet.getCaptions()
      ).toHaveLength(0);
    });

    test("CaptionSets can replace data", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [yay, woof],
        })
      ).captionSet;
      const replaceMutation = makeMutation({
        action: MutationActions.REPLACE,
        note: "woof is a bark",
        before: woof,
        after: bark,
      });
      expect(underTest.getCaptions()).toHaveLength(2);
      expect(
        CaptionSet.completeMutation(replaceMutation, underTest)
          .captionSet.getCaptions()
          .find((c) => c.uuid === bark.uuid)?.text
      ).toEqual("bark");
      expect(
        CaptionSet.completeMutation(replaceMutation, underTest)
          .captionSet.getCaptions()
          .find((c) => c.uuid === woof.uuid)?.text
      ).not.toEqual("woof");
    });
  });

  describe("Data Rule Conformation", () => {
    test("sort order by start time", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [woof, yay, bark],
        })
      ).captionSet;
      const caps = underTest.getCaptions();
      expect(caps[0]?.uuid).toEqual(yay.uuid);
      expect(caps[1]?.uuid).toEqual(bark.uuid);
      expect(caps[2]?.uuid).toEqual(woof.uuid);
    });

    test("index element is the index in the captions array", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [woof, yay, bark],
        })
      ).captionSet;
      expect(underTest.getCaptions()).toHaveLength(3);
      underTest.getCaptions().forEach((e, i) => expect(e.index).toEqual(i));
    });

    test("start is at least one ms after the previous end", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [woof, yay, bark],
        })
      ).captionSet;
      expect(underTest.getCaptions()).toHaveLength(3);
      underTest
        .getCaptions()
        .forEach((e, i, arr) =>
          expect(e.start).toBeGreaterThanOrEqual(i ? arr[i - 1].end + 0.001 : 0)
        );
    });

    test("startRaw matches the format rules", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [woof, yay, bark],
        })
      ).captionSet;
      expect(underTest.getCaptions()).toHaveLength(3);
      const caps = underTest.getCaptions();
      expect(caps[0]?.startRaw).toEqual("00:00:00.000");
      expect(caps[1]?.startRaw).toEqual("00:00:01.001");
      expect(caps[2]?.startRaw).toEqual("00:00:02.501");
    });

    test("endRaw matches the format rules", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [woof, yay, bark],
        })
      ).captionSet;
      expect(underTest.getCaptions()).toHaveLength(3);
      const caps = underTest.getCaptions();
      expect(caps[0]?.endRaw).toEqual("00:00:01.000");
      expect(caps[1]?.endRaw).toEqual("00:00:02.500");
      expect(caps[2]?.endRaw).toEqual("00:00:03.000");
    });

    test("prevCaption is the previous caption", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [woof, yay, bark],
        })
      ).captionSet;
      expect(underTest.getCaptions()).toHaveLength(3);
      underTest
        .getCaptions()
        .forEach((e, i, arr) =>
          expect(e.prevCaption).toEqual(i ? arr[i - 1] : void 0)
        );
    });

    test("backSize has the ms between this start and the end of the previous caption", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [woof, yay, bark],
        })
      ).captionSet;
      expect(underTest.getCaptions()).toHaveLength(3);
      const caps = underTest.getCaptions();
      expect(caps[0]?.backSize).toBeCloseTo(0, 3);
      expect(caps[1]?.backSize).toBeCloseTo(1, 3);
      expect(caps[2]?.backSize).toBeCloseTo(1, 3);
    });

    test("nextCaption is the next caption", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [woof, yay, bark],
        })
      ).captionSet;
      expect(underTest.getCaptions()).toHaveLength(3);
      underTest
        .getCaptions()
        .forEach((e, i, arr) =>
          expect(e.nextCaption).toEqual(
            i < arr.length - 1 ? arr[i + 1] : void 0
          )
        );
    });

    test("foreSize has the ms between this end and the start of the next caption", () => {
      const underTest = CaptionSet.completeMutation(
        makeMutation({
          action: MutationActions.BULK_ADD,
          note: "yay",
          bulk: [woof, yay, bark],
        })
      ).captionSet;
      expect(underTest.getCaptions()).toHaveLength(3);
      const caps = underTest.getCaptions();
      expect(caps[0]?.foreSize).toBeCloseTo(1, 3);
      expect(caps[1]?.foreSize).toBeCloseTo(1, 3);
      expect(caps[2]?.foreSize).toBeCloseTo(1, 3);
    });
  });
});
