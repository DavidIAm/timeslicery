import React from "react";
import { Caption } from "./Caption";
import { v4 } from "uuid";
import { Line } from "./Line";

export const LineSet: React.FC<{
  set: Caption[];
  position: number;
  top: number;
  bottom: number;
}> = ({ set, position, top, bottom }) => (
  <>
    {set.slice(top, bottom).map((c, s) => (
      <Line {...c} current={position === c.index} key={v4()} />
    ))}
  </>
);
