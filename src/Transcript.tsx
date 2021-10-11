import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from "react";
import EventEmitter from "events";
import { Lines } from "./Lines";
import { format, useClock } from "./Util";
import { CaptionFile } from "./CaptionFile";

export const EditContext = createContext<{
  clock: EventEmitter;
  keyboard: EventEmitter;
}>({
  clock: new EventEmitter(),
  keyboard: new EventEmitter(),
});

export const Transcript: React.FC<{ transcript: CaptionFile }> = ({
  transcript,
}) => {
  const { clock } = useContext(EditContext);

  useClock(
    "withCurrentUndoIndex",
    (event, ...args) => clock.emit(event, transcript.changes.length, ...args),
    []
  );
  useClock(
    "setCurrentUndoIndex",
    (index: number) => {
      while (transcript.changes.length > index) {
        const e = transcript.changes.pop();
        if (e) transcript.undoneChanges.unshift(e);
      }
    },
    []
  );
  const cutInHalf = useCallback(
    (index) => {
      console.log("CPATION", index);
      const caption = transcript.captions[index];
      if (!caption) return;
      caption.end = caption.start + (caption.end - caption.start) / 2;
      caption.endRaw = format(caption.end);
    },
    [transcript.captions]
  );
  useEffect(() => {
    clock.on("cutInHalf", cutInHalf);
    return (): void => {
      clock.off("cutInHalf", cutInHalf);
    };
  }, [clock, cutInHalf]);

  return (
    <div style={{ width: "100%" }}>
      <Lines captions={transcript.captions} />
    </div>
  );
};

export type RangeSetter = (e: number, f: number) => void;
