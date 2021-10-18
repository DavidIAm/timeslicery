import { CaptionSet } from "./CaptionSet";
import { mutateCaption, Mutation, MutationActions } from "./Mutation";
import { useMutationHandlers } from "./MutationHandlers";
import { render } from "@testing-library/react";
import { EditContext } from "./Transcript";
import EventEmitter from "events";
import { baa, bark, woof, yay } from "./TestCaptions";
import { Caption } from "./Caption";
import { useContext, useEffect } from "react";

//                      ----?++++?====
// event - cue-in with state on - now(3)
//  newStartFor 3 + --> --+++++++?====
// event - cue-in with state on - now(6)
//  newEndFor 6 -       ------+++?====
// event - cute in with state off - now(6)
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
  let underTest: CaptionSet;
  let renderBuild: (
    ...emitArgs: [string, ...any[]]
  ) => Promise<Mutation<Caption>>;

  test("mutate with start before previous end", () =>
    renderBuild("newStartFor", yay.start + 0.5, "note", woof).then(
      (mutation) => {
        const captions = CaptionSet.completeMutation(
          mutation,
          underTest
        ).set.getCaptions();

        captions.map((c) => console.log(c.text, c.start, c.end));
        expect(captions.find((c) => c.text === "yay")?.end).toBeCloseTo(
          yay.start + 0.5 - 0.001,
          3
        );
        expect(captions.find((c) => c.text === "woof")?.start).toBeCloseTo(
          yay.start + 0.5,
          1
        );
        captions
          .filter((c) => c.index) // because the first one has index of 0 which is not truthy
          .forEach((e) => {
            expect(e.prevCaption?.end).toBeLessThanOrEqual(e.start - 0.001);
            expect(
              e.nextCaption?.start || e.end + 0.001
            ).toBeGreaterThanOrEqual(e.end);
          });
      }
    ));

  beforeEach(() => {
    underTest = CaptionSet.completeMutation(
      mutateCaption({
        action: MutationActions.BULK_ADD,
        note: "yay",
        bulk: [yay, woof, baa],
      })
    ).set;
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
      });
  });
});
