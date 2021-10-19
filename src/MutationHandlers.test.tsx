import { CaptionSet } from "./CaptionSet";
import {
  CompletedMutation,
  mutateCaption,
  Mutation,
  MutationActions,
} from "./Mutation";
import { useMutationHandlers } from "./MutationHandlers";
import { render } from "@testing-library/react";
import { EditContext } from "./Transcript";
import EventEmitter from "events";
import { baa, woof, yay } from "./TestCaptions";
import { Caption } from "./Caption";
import { useContext, useEffect } from "react";

//                      ----?++++?====
// event - cue-in with state on - now(3)
//  newStartFor 3 + --> --+++++++?==== ✅
// event - cue-in with state on - now(6)
//  newEndFor 6 -       ------+++?==== ✅
// event - cue in with state off - now(6)
//  newStartFor 6 + --> ----??+++?====
// event - cue out (now 6)
//  newEndFor 6 -       ------+++?====
// event - cue in with state off (now 6)
//  newStartFor 12 +    ------??????+=
//  newStartFor 12 +    ------??????+=
//            provisional           +
//            provisional         ====
//  newEndFor 2 -       --???++++?====
//  newEndFor 6 -       ------+++?====
//  newEndFor 12 -    ------------+=
//  newStartFor 4 =     ---+========== // but if you're playing you're NOT back multiple captions

describe("MutationHandlers", () => {
  let underTest: CompletedMutation<Caption, CaptionSet>;
  let renderBuild: (
    ...emitArgs: [string, ...any[]]
  ) => Promise<CompletedMutation<Caption, CaptionSet>>;
  const finder = (
    mutation: CompletedMutation<Caption, CaptionSet>,
    seek: Caption
  ) => mutation.set.getCaptions().find((c) => c.text === seek.text);

  test("mutate with start before previous end", () =>
    renderBuild("newStartFor", yay.start + 0.5, "note", woof).then(
      (mutation) => {
        expect(finder(mutation, yay)?.end).toBeCloseTo(
          yay.start + 0.5 - 0.001,
          3
        );
        expect(finder(mutation, woof)?.start).toBeCloseTo(yay.start + 0.5, 1);
        mutation.set
          .getCaptions()
          .filter((c) => c.index) // because the first one has index of 0 which is not truthy
          .forEach((e) => {
            expect(e.prevCaption?.end).toBeLessThanOrEqual(e.start - 0.001);
            expect(
              e.nextCaption?.start || e.end + 0.001
            ).toBeGreaterThanOrEqual(e.end);
          });
      }
    ));

  test("mutate with end after next start", () =>
    renderBuild("newEndFor", woof.start + 0.5, "newEnd", yay).then(
      (mutation) => {
        expect(finder(mutation, yay)?.end).toBeCloseTo(woof.start + 0.5, 3);
        expect(finder(mutation, woof)?.start).toBeCloseTo(
          woof.start + 0.5 + 0.001,
          1
        );
      }
    ));

  test("gapBefore", () =>
    renderBuild("gapBefore", finder(underTest, woof)).then((mutation) => {
      expect(mutation.note).toContain("consume gap before");
      expect(finder(mutation, woof)?.start).toBeCloseTo(yay.end + 0.001, 2);
    }));

  test("gapAfter", () =>
    renderBuild("gapAfter", finder(underTest, woof)).then((mutation) => {
      expect(mutation.note).toContain("consume gap after");
      expect(finder(mutation, woof)?.end).toBeCloseTo(baa.start - 0.001, 2);
    }));
  test("newVoiceFor", () =>
    renderBuild(
      "newVoiceFor",
      "Voicey",
      "human voice",
      finder(underTest, woof)
    ).then((mutation) => {
      expect(mutation.note).toContain("human voice");
      expect(finder(mutation, woof)?.voice).toEqual("Voicey");
    }));

  test("newTextFor", () =>
    renderBuild("newTextFor", "Bark", "barknote", finder(underTest, woof)).then(
      (mutation) => {
        expect(mutation.note).toContain("barknote");
        expect(finder(mutation, mutation.after!)?.text).toEqual("Bark");
      }
    ));

  beforeEach(() => {
    underTest = CaptionSet.completeMutation(
      mutateCaption({
        action: MutationActions.BULK_ADD,
        note: "yay",
        bulk: [yay, woof, baa],
      })
    );
    renderBuild = (event, ...emitArgs: [string, ...any]) =>
      new Promise<Mutation<Caption>>((resolve, reject) => {
        const clock = new EventEmitter();
        const UnderTest = () => {
          const { clock } = useContext(EditContext);
          useMutationHandlers(resolve);
          useEffect(() => {
            if (!clock) return;
            clock.emit(event, ...emitArgs);
          });
          return <></>;
        };
        render(
          <EditContext.Provider value={{ clock, keyboard: clock }}>
            <UnderTest />
          </EditContext.Provider>
        );
      }).then((mutation) =>
        CaptionSet.completeMutation(mutation, underTest.set)
      );
  });
});
