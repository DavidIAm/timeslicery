import React from "react";
import { Caption } from "./Caption";
import { useClock } from "./Util";

export const MutationHandlers: React.FC<{
  replaceMutationFromPartial: (
    caption: Caption,
    note: string,
    captionToPartial: (c: Caption) => Partial<Caption>
  ) => void;
}> = ({ replaceMutationFromPartial: rmfp, children }) => {
  useClock(
    "gapBefore",
    (caption) =>
      rmfp(caption, "consume gap before", (c) => ({
        start: c.start - (c?.backSize || 0) / 1000,
      })),
    [rmfp]
  );

  useClock(
    "gapAfter",
    (caption) =>
      rmfp(caption, "consume gap after", (c) => ({
        end: c.end + (c?.foreSize || 0) / 1000,
      })),
    [rmfp]
  );

  useClock(
    "newStartFor",
    ({ caption, time, note }) =>
      rmfp(caption, "new start : " + note, () => ({
        start: time,
      })),
    [rmfp]
  );

  useClock(
    "newEndFor",
    ({ caption, time, note }) => {
      console.log("new end for", caption, time, note);
      return rmfp(caption, "new end : " + note, () => ({
        end: time,
      }));
    },
    [rmfp]
  );

  return <>{children}</>;
};
