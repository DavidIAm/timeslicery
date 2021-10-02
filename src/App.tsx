import React, {useCallback, useContext, useEffect, useMemo, useReducer, useState} from 'react';
import './App.css';
import ReactAudioPlayer from "react-audio-player";
import {Caption, CaptionFile, EditContext, parserFactory, TimeContext, Transcript} from "./Transcript";
import {v4} from 'uuid';
import EventEmitter from 'events';

export const format = (raw: number): string => {
    const hours = Math.floor(raw / (60 * 60))
    const minutes = Math.floor((raw - hours * 60 * 60) / (60))
    const seconds = (raw - hours * 60 * 60 - minutes * 60)
    return `${hours.toFixed(0).padStart(2, '0')}:${minutes.toFixed(0).padStart(2, '0')}:${seconds.toFixed(5).padStart(2)}`
}

function App() {
    const keyboard = useMemo(() => new EventEmitter(), [])
    const clock = useMemo(() => new EventEmitter(), [])
    useEffect(() => {
        document.onkeyup = event => {
            const {code} = event
            keyboard.emit('keyboard', event)
            keyboard.emit(code, event)
            console.log(event)
        }
    }, [keyboard])
    const editContextValue = useMemo(() => ({clock, keyboard}), [clock, keyboard])
    return (
        <div onKeyPress={console.log} className="App">
            <header className="App-header">
                <EditContext.Provider value={editContextValue}>
                    <UrlBox/>
                </EditContext.Provider>
            </header>
        </div>
    );
}

export const EditBox: React.FC<{ caption: Caption }> = ({
                                                            caption: {start, end, voice, text} = {
                                                                start: 0,
                                                                end: 0,
                                                                voice: "Empty",
                                                                text: "Empty"
                                                            }, children
                                                        }) => {
    const {clock} = useContext(EditContext)
    const [textArea, setTextArea] = useState<HTMLTextAreaElement | null>()

    const [voiceSet, dispatchVoice] = useReducer((set: Set<string>, newSet: Set<string>) => newSet, new Set<string>(["empty"]))
    const keyboardHandler = useCallback(({key}) => void 0, [])
    useEffect(() => {
        if (!textArea) return
        textArea.value = text || "space left blank"
    }, [text, textArea])
    useEffect(() => {
        clock.on('voiceSet', (set) => dispatchVoice(set))
        clock.on('Period', keyboardHandler)
        clock.on('Comma', keyboardHandler)
        clock.on('KeyB', keyboardHandler)
    }, [dispatchVoice, keyboardHandler, clock])
    return (<>
        <div>
            <div>
                <label htmlFor={"start"}>Start</label>
                <input name={"start"} value={start} type={"text"}
                       onChange={e => clock.emit('setStart', parseInt(e.target.value))}/>
            </div>
            <div>
                <label htmlFor={"end"}>End</label>
                <input name={"end"} type={"text"} value={end}
                       onChange={e => clock.emit('setEnd', parseInt(e.target.value))}/>
            </div>
        </div>
        <div>
            <label htmlFor="voice">Voice</label>
            <select name="voice" ref={t => clock.emit('setSpeaking', t)} defaultValue={voice}>{
                Array.from(voiceSet.values()).sort().map(speaking =>
                    <option key={v4()} value={speaking}>{speaking}</option>
                )
            }</select>
            <textarea style={{fontSize: "1em"}} ref={t => setTextArea(t)} cols={60}
                      onKeyPressCapture={console.log} onKeyDown={console.log}
                      defaultValue={""}/>
        </div>
    </>)
}


export const MediaBox: React.FC<{ transcript: CaptionFile, audio: string }> = ({transcript, audio}) => {
    const {clock} = useContext(EditContext)
    const [ref, setRef] = useState<HTMLAudioElement | null>()
    const [time, setTime] = useState<number>(0)
    const [loop] = useState<Boolean>(false)
    const [caption, setCaption] = useState<Caption>()
    useEffect(() => void clock.on('caption', setCaption), [caption, clock])
    useEffect(() => {
        if (!ref) return
        if (!caption) return
        if (time > caption.end && loop) ref.currentTime = caption.start;
    }, [time, ref, caption, caption?.end, caption?.start, loop])
    return <><ReactAudioPlayer ref={e => setRef(e?.audioEl.current)} listenInterval={199} onListen={setTime} src={audio}
                               controls onPlay={() => ref && caption ? ref.currentTime = caption.start : void -1}/>
        <TimeContext.Provider value={time}>
            <Transcript transcript={transcript}/>
        </TimeContext.Provider>
    </>
}

export const UrlBox: React.FC = () => {
    const {clock} = useContext(EditContext)
    const [src, setSrc] = useState<string>("/S3E3_Get_Help.mp3")
    const [transcript, setTranscript] = useState<string>("/S3E3_Get_Help_fuckedup.vtt")

    const [voices, voiceDispatch] = useReducer<(voices: Set<string>, fresh: { voices: string[], clear: boolean }) => Set<string>, string[]>((set, {
        voices,
        clear
    }) => new Set<string>(clear ? [] : [...Array.from(set.values()), ...voices]), [], t => new Set<string>(t))
    const [captions, dispatch] = useReducer<(cf: CaptionFile, fresh: { array: Caption[], clear: boolean }) => CaptionFile, CaptionFile>((cf, {
            array,
            clear
        }) => {
            if (clear) {
                cf.captions = []
                voiceDispatch({voices: [], clear: true})
            } else cf.captions.push(...array)
            voiceDispatch({voices: cf.captions.map(({voice}) => voice), clear: false})
            return Object.assign({}, cf)
        }
        , {captions: [], format: "", text: ""} as CaptionFile
        , (t) => t)

    useEffect(() => void clock.emit('setVoices', voices), [voices, clock])
    useEffect(() => {
        if (!transcript) return
        if (!dispatch) return
        if (!parserFactory) return
        console.log("fetch start", transcript)
        fetch(transcript).then(res => res?.body?.pipeTo(parserFactory(dispatch))).then(() => console.log("Done fetch"))
    }, [transcript])

    return <>
        <div><label
            htmlFor={"source"}>Audio</label><input name={"source"} type={"text"} defaultValue={src}
                                                   onChange={e => setSrc(e.target.value)}/></div>
        <div><label htmlFor={"transcript"}>Transcript</label><input name={"transcript"} type={"transcript"}
                                                                    value={transcript}
                                                                    onChange={e => setTranscript(e.target.value)}/>
        </div>
        <MediaBox transcript={captions} audio={src}/>
    </>
}
export default App;
