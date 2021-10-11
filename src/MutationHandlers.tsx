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
    (time, note, caption) =>
      rmfp(caption, "new start : " + note, () => ({
        start: time,
      })),
    [rmfp]
  );

  useClock(
    "newEndFor",
    (time, note, caption) => {
      console.log("new end for", caption, time, note);
      return rmfp(caption, "new end : " + note, () => ({
        end: time,
      }));
    },
    [rmfp]
  );

  useClock(
    "newTextFor",
    (text, note, caption) => {
      console.log("new text for", text, caption, note);
      return rmfp(caption, "new text : " + note, () => ({
        text,
      }));
    },
    [rmfp]
  );

  useClock(
    "newVoiceFor",
    (voice, note, caption) => {
      console.log("new voice for", voice, caption, note);
      return rmfp(caption, "new voice : " + note, () => ({
        voice,
      }));
    },
    [rmfp]
  );

  return <>{children}</>;
};
