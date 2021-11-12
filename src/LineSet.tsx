import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Caption, CUE_STATE, Selected } from "./Caption";
import { v4 } from "uuid";
import { Line } from "./Line";
import { EditContext } from "./Transcript";
import { useClock } from "./Util";
import { CueContext } from "./Lines";

export const Gap: React.FC<{
  slot: number;
  insertTime: number;
  size: number;
  index?: number;
  activeStart: number;
  activeEnd: number;
  directionKey: "after" | "before";
}> = ({
  slot,
  insertTime,
  size,
  index,
  activeStart,
  activeEnd,
  directionKey,
}) => {
  const { clock } = useContext(EditContext);
  const cueState = useContext(CueContext);

  const [selectedCaption, setSelectedCaption] = useState<Selected<Caption>>();
  const updateSelectedCaption = useCallback(
    (selected: Selected<Caption>) => {
      if (!selected) return;
      setSelectedCaption(selected);
      if (selected.caption.index === index)
        console.log(
          `(gap ${slot}) Set selected caption`,
          selected.caption.index,
          selected.gapDirection
        );
      return (): void => {
        console.log(`(gap ${slot}) Clear selected caption`);
        setSelectedCaption(void 0);
      };
    },
    [slot, index]
  );
  useClock("setSelectedCaption", updateSelectedCaption, []);

  const insert = useCallback(
    () => clock.emit("startInsert", insertTime),
    [clock, insertTime]
  );
  const [selected, setSelected] = useState<boolean>(false);

  const iAmSelected = useCallback((): boolean => {
    if (!selectedCaption) return false;
    const { caption, gapDirection } = selectedCaption;
    if (caption.index === index && gapDirection === directionKey) return true;
    const which =
      directionKey === "after"
        ? caption.prevCaption
        : directionKey === "before"
        ? caption.nextCaption
        : void 0;
    console.log(
      `(gap ${slot})`,
      index,
      caption.index,
      directionKey,
      gapDirection,
      caption.prevCaption?.index,
      caption.nextCaption?.index,
      which?.index,
      which?.index === index,
      caption
    );
    return which?.index === index;
  }, [slot, selectedCaption, index, directionKey]);

  const highlightActive = useCallback(
    (caption, gapDirection, index) =>
      caption.index === index ||
      caption.nextCaption?.index === index ||
      caption.prevCaption?.index === index,
    []
  );
  const highlight = useCallback(
    (time) => {
      if (!selectedCaption) return;
      const { caption, gapDirection } = selectedCaption;
      if (!highlightActive(caption, gapDirection, index)) return;
      if (cueState !== CUE_STATE.CUE_OFF) {
        if (
          selectedCaption.gapDirection === directionKey &&
          selectedCaption.caption.index !== index
        )
          return;
        if (cueState === CUE_STATE.CUE_GAP) setSelected(iAmSelected());
      } else setSelected(time >= activeStart && time < activeEnd);
      return (): void => setSelected(false);
    },
    [iAmSelected, activeStart, activeEnd, selectedCaption, cueState, index]
  );
  useEffect(() => {
    clock.on("time", highlight);
    return (): void => void clock.off("time", highlight);
  }, [clock, highlight]);

  return (
    <div
      style={{
        height: "10px",
        width: "100%",
        ...(selected ? { backgroundColor: "gray" } : {}),
        fontSize: "10px",
        textAlign: "left",
      }}
    >
      {size.toFixed(0)}ms{" "}
      <button
        style={{
          fontSize: "12px",
          color: "yellow",
          textDecoration: "underline",
          padding: 2,
          backgroundColor: "black",
          border: 0,
        }}
        onClick={insert}
      >
        Insert
      </button>
    </div>
  );
};
export const LineAndAfterGap: React.FC<{ caption: Caption; slot: number }> = ({
  caption,
  slot,
}) => {
  if (!caption) return <p>No caption loaded</p>;
  return (
    <div>
      <Line
        slot={slot}
        {...caption}
        activeStart={caption.start}
        activeEnd={caption.end}
      />
      <Gap
        insertTime={caption.end}
        slot={slot}
        size={caption.foreSize || 0}
        activeStart={caption.end}
        index={caption.index}
        activeEnd={caption.nextCaption?.start || caption.end + 2}
        directionKey={"after"}
      />
    </div>
  );
};
export const LineSet: React.FC<{
  set: Caption[];
  top: number;
  bottom: number;
}> = ({ set, top, bottom }) => {
  //  useEffect(() => console.log("mutation in set"), [set]);
  useEffect(() => console.log("mutation in top"), [top]);
  useEffect(() => console.log("mutation in bottom"), [bottom]);
  const [first, second, third, fourth, fifth] = useMemo(
    () => set.slice(top, bottom),
    [set, top, bottom]
  );
  return (
    <>
      <Gap
        key={v4()}
        slot={0}
        activeStart={0}
        activeEnd={first?.start}
        index={first?.index}
        insertTime={first?.prevCaption?.start || 0}
        size={first?.backSize || 0}
        directionKey={"before"}
      />
      <LineAndAfterGap slot={1} caption={first} />
      <LineAndAfterGap slot={2} caption={second} />
      <LineAndAfterGap slot={3} caption={third} />
      <LineAndAfterGap slot={4} caption={fourth} />
      <LineAndAfterGap slot={5} caption={fifth} />
    </>
  );
};
