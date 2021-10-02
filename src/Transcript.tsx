import React, {createContext, useContext, useEffect, useReducer, useState} from "react";
import {v4} from "uuid";
import EventEmitter from "events";
import {EditBox} from "./App";

function Utf8ArrayToStr(array: Uint8Array): string {
    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
        switch (c >> 4) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12:
            case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }

    return out;
}

const toSeconds = (raw: string): number => {
    if (!raw) return 0
    const [h, m, s] = raw.split(':').map(parseFloat)
    return h * 60 * 60 + m * 60 + s
}

export interface Caption {
    start: number
    startRaw: string
    end: number
    endRaw: string
    align: string
    voice: string
    text: string
}

export interface CaptionFile {
    captions: Caption[]
    format: string
    text: string
}

export const TimeContext = createContext<number>(0)
export type EditVoiceList = (v: Set<string>) => void
export const EditContext = createContext<{ clock: EventEmitter, keyboard: EventEmitter }>({
    clock: new EventEmitter(),
    keyboard: new EventEmitter()
})
export const parserFactory = (dispatch: React.Dispatch<{ array: Caption[], clear: boolean }>) => new WritableStream({
    start(controller: any) {
        dispatch({array: [], clear: true})
        controller.holdover = ""
    },
    write(chunk: Uint8Array, controller: any) {
        const stringy = Utf8ArrayToStr(chunk)
        const lines = `${controller.holdover}${stringy}`.split(/\r\n\r\n/).filter((line) => /\d/.test(line))
        if (!/\r\n$/.test(lines[lines.length - 1] || "")) controller.holdover = lines.pop()
        const array = lines
            .map(string => string.split("\r\n"))
            .map(([times, rawText]) => {
                const [, startRaw, endRaw, align] = times?.match(/([^ ]+) --> ([^ ]+)(align:\w+)?/) || []
                const [, voice, text] = rawText?.match(/^<v ([^>]+)> (.+)$/) || []
                return {startRaw, endRaw, align, voice, text}
            })
            .map(d => ({...d, end: toSeconds(d.endRaw)}))
            .map(d => ({...d, start: toSeconds(d.startRaw)}))
        dispatch({array, clear: false})
    },

})


export const Transcript: React.FC<{ transcript: CaptionFile }> = ({transcript}) => {
    return <div style={{width: "100%"}}><Lines all={transcript.captions}/></div>
}

export type RangeSetter = (e: number, f: number) => void
export type LinesProps = {
    all: Caption[]
}
export const Lines: React.FC<LinesProps> = ({all}) => {
    const currentTime = useContext(TimeContext)
    const {keyboard, clock} = useContext(EditContext)
    const [position, changePosition] = useReducer((state: number, changeBy: number) => state + changeBy, -1)
    const [{top, bottom}, setWindow] = useState<{ top: number, bottom: number }>(() => ({top: 0, bottom: 10}))
    useEffect(() => {
        const inc = () => changePosition(+1)
        const dec = () => changePosition(-1)
        keyboard.on('ArrowDown', inc).on('ArrowUp', dec)
        return () => void keyboard.off('ArrowDown', inc).off('ArrowUp', dec)
    }, [keyboard])
    useEffect(() => {
        console.log("position check")
    }, [position])
    useEffect(() => {
        console.log("position update", position)
        if (position < 0) return
        //clock.emit('position', all[position])
        setWindow({
            top: Math.max(position - 1, 0),
            bottom: Math.min(position + 9, all.length),
        })
    }, [position, all.length, all, clock])
    // Do I need an interval tree here!?
    useEffect(() => {
        const pos = all.findIndex(({end, start}) => currentTime <= end && currentTime >= start)
        if (pos > -1) changePosition(pos - position)
    }, [currentTime, all, position])
    return <><EditBox caption={all[position]}/><LineSet position={position} top={top} bottom={bottom} set={all}/></>
}
export const LineSet: React.FC<{ set: Caption[], position: number, top: number, bottom: number }> = ({
                                                                                                         set,
                                                                                                         position,
                                                                                                         top,
                                                                                                         bottom
                                                                                                     }) => {
    return <>{set.slice(top, bottom).map((c, s) => <Line {...c} key={v4()} current={(position - top) === s}/>)}</>
}
export const Line:
    React.FC<Caption & { current: boolean }> = ({
                                                    start,
                                                    end,
                                                    startRaw,
                                                    endRaw,
                                                    voice,
                                                    text,
                                                    align,
                                                    current
                                                }) => {
    const {clock} = useContext(EditContext)
    return (
        <div style={{textAlign: "left", ...(current ? {backgroundColor: "gray"} : {})}}
             onClick={() => clock.emit('setRange', {start, end})}>
            <span>{startRaw} --&gt; {endRaw} {align || ''}</span>
            <p style={{marginBlockStart: "0"}}>&lt;v {voice}&gt; {text}</p>
        </div>
    )
}
