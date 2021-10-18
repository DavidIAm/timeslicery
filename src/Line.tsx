import React, { useCallback, useContext, useEffect, useState } from "react";
import { Caption, CUE_STATE, PLC } from "./Caption";
import { EditContext } from "./Transcript";
import { format, useClock } from "./Util";
import { CueContext } from "./Lines";

export const Line: React.FC<
  Caption & { activeStart: number; activeEnd: number }
> = (caption) => {
  const {
    start,
    end,
    startRaw,
    endRaw,
    voice,
    text,
    align,
    activeStart,
    activeEnd,
  } = caption;
  const { clock } = useContext(EditContext);

  const [lEnd, setLEnd] = useState<number>(activeEnd);
  const [selected, setSelected] = useState<boolean>(false);
  const [playLoopCue, setPlayLoopCue] = useState<PLC>();
  const cueState = useContext(CueContext);

  const updateSelected = useCallback(
    (time: number) => setSelected(time >= activeStart && time <= lEnd),
    [activeStart, lEnd]
  );
  useClock("setSelectedTime", updateSelected, []);

  useEffect(() => {
    if (playLoopCue === PLC.PLAY) {
      clock.on("time", updateSelected);
      return (): void => void clock.off("time", updateSelected);
    }
  }, [playLoopCue, updateSelected, clock]);

  useEffect(() => {
    clock.emit("tellTime");
  }, [clock]);

  // extra time at end time for next visual update
  useEffect(() => {
    clock.once("time", (time) => {
      if (cueState !== CUE_STATE.CUE_OFF) return;
      if (playLoopCue !== PLC.PLAY) return;
      if (time < start || time > end - 50) return;
      const handle = setTimeout(
        () => clock.emit("time", end),
        (end - time) * 1000
      );
      return (): void => clearTimeout(handle);
    });
  }, [cueState, clock, end, start, playLoopCue]);

  useClock("playLoopCue", setPlayLoopCue, []);
  const [lEndRaw, setLEndRaw] = useState(endRaw);
  const updateWithFormat = useCallback((t: number) => {
    setLEnd(t);
    setLEndRaw(format(t));
  }, []);
  useEffect(() => {
    if (!selected) return;
    if (cueState === CUE_STATE.CUE_IN) console.log("CUE STATE IN");
    if (cueState === CUE_STATE.CUE_IN && selected) {
      clock.on("time", updateWithFormat);
      return (): void => void clock.off("time", updateWithFormat);
    }
  }, [clock, updateWithFormat, cueState, selected]);

  useEffect(() => {
    console.log("mount Line");
    return (): void => console.log("unmount Line");
  }, []);

  useEffect(() => {
    if (!caption.index)
      console.log("select state change", caption.index, selected);
  }, [selected, caption.index]);
  return (
    <div
      style={{
        textAlign: "left",
        ...(selected ? { backgroundColor: "gray" } : {}),
      }}
      onClick={() => {
        clock.emit("jumpToCaption", caption);
      }}
    >
      <span>
        {startRaw} --&gt; {lEndRaw} {align || ""}
      </span>
      <p style={{ marginBlock: "0" }}>
        &lt;v {voice}&gt; {text}
      </p>
    </div>
  );
};
