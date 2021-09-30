import React, {useCallback, useEffect, useMemo, useReducer, useState} from 'react';
import './App.css';
import {v4} from 'uuid'
import ReactAudioPlayer from "react-audio-player";

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

const format = (raw: number): string => {
    const hours = Math.floor(raw / (60 * 60))
    const minutes = Math.floor((raw - hours * 60 * 60) / (60))
    const seconds = (raw - hours * 60 * 60 - minutes * 60)
    return `${hours.toFixed(0).padStart(2, '0')}:${minutes.toFixed(0).padStart(2, '0')}:${seconds.toFixed(5).padStart(2)}`
}
type tt = { start: number, end: number, text: string }

const toSeconds = (raw: string): number => {
    if (!raw) return 0
    const [h, m, s] = raw.split(':').map(parseFloat)
    return h * 60 * 60 + m * 60 + s
}

interface Caption {
    start: number
    startRaw: string
    end: number
    endRaw: string
    align: string
    voice: string
    text: string
}

interface CaptionFile {
    captions: Caption[]
    format: string
    text: string
}

const Transcript: React.FC<{ url?: string, setRange: (s: number, e: number) => void }> = ({url, setRange}) => {
    const [captions, dispatch] = useReducer<(cf: CaptionFile, fresh: Caption) => CaptionFile, CaptionFile>((cf, fresh) => {
            if (cf.captions.length < 200) cf.captions.push(fresh)
            return cf
        }
        , {captions: [], format: "", text: ""} as CaptionFile
        , (t) => t)
    const parser = useMemo(() => new WritableStream({
            start(controller: any) {
                console.log("sink start", controller)
            },
            write(chunk: Uint8Array, controller: any) {
                Utf8ArrayToStr(chunk).split(/\r\n\r\n/)
                    .filter((line) => /\d/.test(line))
                    .map(string => string.split("\r\n"))
                    .map(([times, rawText]) => {
                        const [, startRaw, endRaw, align] = times?.match(/([^ ]+) --> ([^ ]+)(align:\w+)?/) || []
                        const [, voice, text] = rawText?.match(/^<v ([^>]+)> (.+)$/) || []
                        return {startRaw, endRaw, align, voice, text}
                    })
                    .map(d => ({...d, end: toSeconds(d.endRaw)}))
                    .map(d => ({...d, start: toSeconds(d.startRaw)}))
                    .forEach(dispatch)
            },
            close() {
                console.log("close")
            },
            abort(reason: any) {
                console.log("abort", reason)
            }

        }),
        []
    )

    useEffect(() => {
        if (!url) return
        console.log("fetch start")
        fetch(url).then(res => res?.body?.pipeTo(parser)).then(() => console.log("fetch done"))
    }, [url, parser])
    console.log("render transscript", captions)
    return <>{captions.captions.map(({start, end, startRaw, endRaw, voice, text, align}) => (
        <div key={v4()}
             onClick={() => setRange(start, end)}><span>{`${startRaw} --> ${endRaw} ${align || ''}`}</span><p>{`<v: ${voice}> ${text}`}</p></div>))}</>
}

function App() {
    const [src, setSrc] = useState<string>("/S3E3_Get_Help.mp3")
    const [transcript, setTranscript] = useState<string>("/S3E3Transcript.vtt")
    const [length, setLength] = useState<number>(2)
    const [start, setStart] = useState<number>(0)
    const [end, setEnd] = useState<number>(length)
    const [time, setTime] = useState<number>(0)
    const [textArea, setTextArea] = useState<HTMLTextAreaElement | null>()
    const [ref, setRef] = useState<ReactAudioPlayer | null>()
    const [element, setElement] = useState<HTMLAudioElement>()
    const [output, dispatch] = useReducer<(tt: tt[], fresh: tt) => tt[], tt[]>((a, fresh) => [...a, fresh], [] as tt[], (t) => t)

    const setRange = useCallback((start, end) => {
        setStart(start);
        setEnd(end)
    }, [setStart, setEnd])
    useEffect(() => {
        if (!ref) return
        if (!ref.audioEl.current) return
        setElement(ref.audioEl.current)
    }, [ref])
    useEffect(() => {
        document.onkeyup = event => {
            const {ctrlKey, key, code} = event
            if (key === '>') {
                setLength(length + 0.2)
                setEnd(start + length)
            }
            if (key === '<') {
                setLength(length - 0.2)
                setEnd(start + length)
            }
            if (code === 'KeyB' && ctrlKey) {
                const starty = start
                setStart(end - length)
                setEnd(starty)
            }
            if (code === 'Space' && ctrlKey) {
                if (textArea?.value) {
                    dispatch({start, end, text: textArea.value})
                    textArea.value = ""
                }
                const mid = end
                setEnd(end + length)
                setStart(mid)
                event.cancelBubble = true
            } else {
                console.log(event)
            }
        }
    }, [length, end, start, textArea, textArea?.value])
    useEffect(() => {
        if (!element) return
        if (time > end) element.currentTime = start;
    }, [time, element, end, start])
    useEffect(() => {
        if (!start) return
        if (!element) return
        element.currentTime = start
    }, [start, element])
    return (
        <div onKeyPress={console.log} className="App">
            <header className="App-header">
                <label htmlFor={"start"}>Start</label><input name={"start"} value={start} type={"text"}
                                                             onChange={e => setStart(parseInt(e.target.value))}/>
                <label htmlFor={"end"}>End</label><input name={"end"} type={"text"} value={end}
                                                         onChange={e => setEnd(parseInt(e.target.value))}/>
                <label
                    htmlFor={"source"}>Audio</label><input name={"source"} type={"text"} value={src}
                                                           onChange={e => setSrc(e.target.value)}/>
                <label htmlFor={"transcript"}>Transcript</label><input name={"transcript"} type={"transcript"}
                                                                       value={transcript}
                                                                       onChange={e => setTranscript(e.target.value)}/>
                <ReactAudioPlayer ref={e => setRef(e)} listenInterval={100} onListen={setTime} src={src} autoPlay
                                  controls onPlay={() => element ? element.currentTime = start : void 0}/>
                <textarea ref={t => setTextArea(t)} onKeyPressCapture={console.log} onKeyDown={console.log}
                          defaultValue={""}/>
                <Transcript url={transcript} setRange={setRange}/>
                <pre>
                {output.map(({
                                 start,
                                 end,
                                 text
                             }) => `${format(start)} --> ${format(end)} align:middle\n${text}\n`).join("\n")}
            </pre>
            </header>
        </div>
    );
}

export default App;
