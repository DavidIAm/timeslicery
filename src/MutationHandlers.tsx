import React, { useContext, useEffect } from "react";
import { Caption } from "./Caption";
import { EditContext } from "./Transcript";

export const MutationHandlers: React.FC<{
  replaceMutationFromPartial: (
    uuid: string,
    note: string,
    captionToPartial: (c: Caption) => Partial<Caption>
  ) => void;
}> = ({ replaceMutationFromPartial, children }) => {
  const { clock } = useContext(EditContext);

  useEffect(() => {
    if (!clock) return;
    const gapBefore = (uuid: string) =>
      replaceMutationFromPartial(uuid, "consume gap before", (c) => ({
        start: c.start - (c?.backSize || 0) / 1000,
      }));
    clock.on("gapBefore", gapBefore);
    return (): void => void clock.off("gapBefore", gapBefore);
  }, [clock, replaceMutationFromPartial]);

  useEffect(() => {
    if (!clock) return;
    const gapBefore = (uuid: string) =>
      replaceMutationFromPartial(uuid, "consume gap after", (c) => ({
        end: c.end + (c?.foreSize || 0) / 1000,
      }));
    clock.on("gapAfter", gapBefore);
    return (): void => void clock.off("gapAfter", gapBefore);
  }, [clock, replaceMutationFromPartial]);

  useEffect(() => {
    const newStartFor: (o: {
      uuid: string;
      time: number;
      note: string;
    }) => void = ({ uuid, time, note }) =>
      replaceMutationFromPartial(uuid, "new start : " + note, () => ({
        start: time,
      }));
    clock.on("newStartFor", newStartFor);
    return (): void => void clock.off("newStartFor", newStartFor);
  }, [clock, replaceMutationFromPartial]);
  useEffect(() => {
    const newEndFor: (o: { uuid: string; time: number; note: string }) => void =
      ({ uuid, time, note }) =>
        replaceMutationFromPartial(uuid, "new end : " + note, () => ({
          start: time,
        }));
    clock.on("newEndFor", newEndFor);
    return (): void => void clock.off("newEndFor", newEndFor);
  }, [clock, replaceMutationFromPartial]);

  return <>{children}</>;
};
