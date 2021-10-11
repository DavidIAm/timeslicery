import { Caption } from "./Caption";

const diffFields = [
  "startRaw",
  "endRaw",
  "align",
  "voice",
  "text",
  "start",
  "end",
] as (keyof Caption)[];
const unaug: Caption = {
  start: 0,
  end: 1,
  text: "yay",
  uuid: "665b9d40-6884-4c55-ac00-863234706034",
  endRaw: "00:00:01.000",
  startRaw: "00:00:00.000",
  align: "",
  voice: "",
};
const aug: Caption = {
  start: 0,
  end: 1,
  text: "yay",
  uuid: "923886a5-41bc-4730-90a5-bbe9b21869c1",
  endRaw: "00:00:01.000",
  startRaw: "00:00:00.000",
  align: "",
  voice: "",
  index: 0,
  prevCaption: undefined,
  backSize: 0,
  nextCaption: undefined,
  foreSize: 1,
};

describe("Caption", () => {
  test("compares same", () => {
    expect(Caption.equals(unaug, aug)).toBeTruthy();
  });
  test("same with diff uuid", () => {
    expect(
      Caption.equals(Object.assign({}, aug, { uuid: "not" }), aug)
    ).toBeTruthy();
  });
  test("diff with diff vals", () => {
    diffFields.forEach((field) =>
      expect(
        Caption.equals(
          Object.assign({}, aug, { [field]: aug[field] + "-" }),
          aug
        )
      ).not.toBeTruthy()
    );
  });
  test("diff with missing vals", () => {
    diffFields.forEach((field) => {
      const attenuated = delete Object.assign({}, aug, { uuid: "not" })[field];
      expect(
        Caption.equals(attenuated as unknown as Caption, aug)
      ).not.toBeTruthy();
    });
  });
});
