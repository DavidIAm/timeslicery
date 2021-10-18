import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Caption } from "./Caption";
import { v4 } from "uuid";
import { Line } from "./Line";
import { EditContext } from "./Transcript";

export const Gap: React.FC<{
  insertTime: number;
  size: number;
  activeStart: number;
  activeEnd: number;
}> = ({ insertTime, size, activeStart, activeEnd }) => {
  const { clock } = useContext(EditContext);
  const insert = useCallback(
    () => clock.emit("startInsert", insertTime),
    [clock, insertTime]
  );
  const [selected, setSelected] = useState<boolean>(false);
  const highlight = useCallback(
    (time) => setSelected(time >= activeStart && time < activeEnd),
    [activeStart, activeEnd]
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
export const LineAndAfterGap: React.FC<{ caption: Caption }> = ({
  caption,
}) => {
  useEffect(() => {
    console.log("mount LAAG");
    return (): void => console.log("unmount LAAG");
  }, []);
  if (!caption) return <p>No caption loaded</p>;
  return (
    <div>
      <Line {...caption} activeStart={caption.start} activeEnd={caption.end} />
      <Gap
        insertTime={caption.end}
        size={caption.foreSize || 0}
        activeStart={caption.end}
        activeEnd={caption.nextCaption?.start || caption.end + 2}
      />
    </div>
  );
};
export const LineSet: React.FC<{
  set: Caption[];
  top: number;
  bottom: number;
}> = ({ set, top, bottom }) => {
  useEffect(() => {
    console.log("mount LineSet");
    return (): void => console.log("unmount LineSet");
  }, []);
  useEffect(() => console.log("mutation in set"), [set]);
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
        activeStart={0}
        activeEnd={set[top]?.start}
        insertTime={set[top]?.prevCaption?.start || 0}
        size={set[top]?.backSize || 0}
      />
      <LineAndAfterGap caption={first} />
      <LineAndAfterGap caption={second} />
      <LineAndAfterGap caption={third} />
      <LineAndAfterGap caption={fourth} />
      <LineAndAfterGap caption={fifth} />
    </>
  );
};
