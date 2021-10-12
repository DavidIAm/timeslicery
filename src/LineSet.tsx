import React, { useCallback, useContext } from "react";
import { Caption } from "./Caption";
import { v4 } from "uuid";
import { Line } from "./Line";
import { EditContext } from "./Transcript";

export const Gap: React.FC<{
  insertTime: number;
  size: number;
  current: Caption;
  selected: boolean;
}> = ({ selected, insertTime, size }) => {
  const { clock } = useContext(EditContext);
  const insert = useCallback(
    () => clock.emit("startInsert", insertTime),
    [clock, insertTime]
  );
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
      {size.toFixed(3)}ms{" "}
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
export const LineSet: React.FC<{
  set: Caption[];
  position: number;
  top: number;
  bottom: number;
}> = ({ set, position, top, bottom }) => {
  return (
    <>
      <Gap
        current={set[top]}
        insertTime={set[top]?.prevCaption?.start || 0}
        size={set[top]?.backSize || 0}
        selected={position === (set[top]?.index || 0) - 0.5}
      />
      {set.slice(top, bottom).map((c) => (
        <>
          <Line {...c} current={position === c.index} key={v4()} />
          <Gap
            current={c}
            insertTime={c.end}
            size={c.foreSize || 0}
            selected={position === (c?.index || 0) + 0.5}
          />
        </>
      ))}
    </>
  );
};
