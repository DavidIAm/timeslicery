import React from "react";
import { Caption } from "./Caption";
import { useClock } from "./Util";

export const MutationHandlers: React.FC<{
  replaceMutationFromPartial: (
    uuid: string,
    note: string,
    captionToPartial: (c: Caption) => Partial<Caption>
  ) => void;
}> = ({ replaceMutationFromPartial: rmfp, children }) => {
  useClock(
    "gapBefore",
    (uuid: string) =>
      rmfp(uuid, "consume gap before", (c) => ({
        start: c.start - (c?.backSize || 0) / 1000,
      })),
    [rmfp]
  );

  useClock(
    "gapAfter",
    (uuid: string) =>
      rmfp(uuid, "consume gap after", (c) => ({
        end: c.end + (c?.foreSize || 0) / 1000,
      })),
    [rmfp]
  );

  useClock(
    "newStartFor",
    ({ uuid, time, note }) =>
      rmfp(uuid, "new start : " + note, () => ({
        start: time,
      })),
    [rmfp]
  );

  useClock(
    "newEndFor",
    ({ uuid, time, note }) =>
      rmfp(uuid, "new end : " + note, () => ({
        start: time,
      })),
    [rmfp]
  );

  return <>{children}</>;
};
