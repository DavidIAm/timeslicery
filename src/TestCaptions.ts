import { v4 } from "uuid";
import { format } from "./Util";

export const yay = {
  start: 0,
  end: 1,
  text: "yay",
  uuid: v4(),
  startRaw: format(0),
  endRaw: format(1),
  align: "",
  voice: "",
};
export const woof = {
  start: 2,
  end: 3,
  text: "woof",
  uuid: v4(),
  startRaw: format(2),
  endRaw: format(3),
  align: "",
  voice: "",
};
export const bark = {
  start: 0.5,
  end: 2.5,
  text: "bark",
  uuid: v4(),
  startRaw: format(2),
  endRaw: format(3),
  align: "",
  voice: "",
};
export const baa = {
  start: 4,
  end: 5,
  text: "baa",
  uuid: v4(),
  startRaw: format(4),
  endRaw: format(5),
  align: "",
  voice: "",
};
