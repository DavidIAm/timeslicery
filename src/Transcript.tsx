import React, { createContext, useContext } from "react";
import EventEmitter from "events";
import { Lines } from "./Lines";
import { useClock } from "./Util";
import { CaptionFile } from "./CaptionFile";

const clock = new EventEmitter();
clock.setMaxListeners(30);
export const EditContext = createContext<{
  clock: EventEmitter;
  keyboard: EventEmitter;
}>({
  clock,
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

  return (
    <div style={{ width: "100%" }}>
      <Lines captions={transcript.captions} />
    </div>
  );
};

export type RangeSetter = (e: number, f: number) => void;
