import React, { useCallback, useContext, useEffect, useState } from "react";
import { Caption, CUE_STATE, PLC, Selected } from "./Caption";
import { EditContext } from "./Transcript";
import { format, useClock } from "./Util";
import { CueContext } from "./Lines";

export const Line: React.FC<
  Caption & { activeStart: number; activeEnd: number; slot?: number }
> = (caption) => {
  const {
    index,
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
  const [, setLStart] = useState<number>(activeStart);
  const [selected, setSelected] = useState<boolean>(false);
  const [playLoopCue, setPlayLoopCue] = useState<PLC>();
  const [selectedCaption, setSelectedCaption] = useState<Selected<Caption>>();
  const cueState = useContext(CueContext);

  useEffect(() => {
    if (!selectedCaption) return;
    console.log(
      "(line) Selected caption change",
      selectedCaption?.caption.text
    );
  }, [selectedCaption]);
  useEffect(() => console.log("(line) set data change", text), [text]);

  useEffect(() => {
    if (!selectedCaption) return;
    setSelected(
      selectedCaption.caption.index === index &&
        cueState === CUE_STATE.CUE_IN &&
        selectedCaption.gapDirection === "exact"
    );
    return (): void => setSelected(false);
  }, [index, selectedCaption, cueState]);

  const updateSelectedCaption = useCallback(
    (caption: Selected<Caption>) => setSelectedCaption(caption),
    []
  );
  useClock("setSelectedCaption", updateSelectedCaption, []);

  useEffect(() => setLEnd(activeStart), [activeStart]);
  useEffect(() => setLEnd(activeEnd), [activeEnd]);

  const updateSelected = useCallback(
    (time: number) => setSelected(time >= activeStart && time < lEnd),
    [activeStart, lEnd]
  );

  useEffect(() => {
    if (cueState !== CUE_STATE.CUE_OFF) return;
    clock.emit("withTime", "setSelectedTime");
  }, [activeStart, clock, cueState]);
  useClock("setSelectedTime", updateSelected, []);

  useEffect(() => {
    if (playLoopCue !== PLC.PLAY) return;
    clock.on("time", updateSelected);
    return (): void => void clock.off("time", updateSelected);
  }, [playLoopCue, updateSelected, clock]);

  useEffect(() => void clock.emit("tellTime"), [clock]);

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

  const [lStartRaw, setLStartRaw] = useState(startRaw);
  useEffect(() => setLStartRaw(startRaw), [startRaw]);
  const [lEndRaw, setLEndRaw] = useState(endRaw);
  useEffect(() => setLEndRaw(endRaw), [endRaw]);

  const updateStartWithFormat = useCallback((t: number) => {
    setLStart(t);
    setLStartRaw(format(t));
  }, []);

  useEffect(() => {
    if (cueState !== CUE_STATE.CUE_GAP) return; // This only when in gap state
    if (!selectedCaption) return; // make sure we have a selection
    if (index !== selectedCaption.caption.index) return; // this must be the selected caption
    if (selectedCaption.gapDirection === "before") return; // and we're updating the gap before
    clock.on("time", updateStartWithFormat);
    return (): void => {
      void clock.off("time", updateStartWithFormat);
      updateStartWithFormat(start);
    };
  }, [clock, updateStartWithFormat, cueState, start, selectedCaption, index]);

  const updateEndWithFormat = useCallback((t: number) => {
    setLEnd(t);
    setLEndRaw(format(t));
  }, []);
  useEffect(() => {
    if (!selected) return;
    if (cueState !== CUE_STATE.CUE_IN && !selected) return;
    clock.on("time", updateEndWithFormat);
    return (): void => {
      void clock.off("time", updateEndWithFormat);
      updateEndWithFormat(end);
    };
  }, [clock, updateEndWithFormat, cueState, selected, end]);

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
        {lStartRaw} --&gt; {lEndRaw} {align || ""}
      </span>
      <p style={{ marginBlock: "0" }}>
        &lt;v {voice}&gt; {text}
      </p>
    </div>
  );
};
