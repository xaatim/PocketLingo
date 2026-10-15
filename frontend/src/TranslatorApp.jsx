/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState, useEffect, useRef, useCallback } from "react"
import LanguageLane from "./components/LanguageLane"
import ResponseDrawer from "./components/ResponseDrawer"
import Visualizer from "./components/Visualizer"
import { useAudioRecorder } from "./hooks/useAudioRecorder"
import {
  transcribeAudio,
  translateText,
  splitTextIntoSpeechChunks,
} from "./utils/api"
import { playBlip } from "./utils/audio-blip"

// Core orchestrator for the two-person translator.
// Flow: tap RECORD → mic capture (useAudioRecorder) → POST /api/stt (Moonshine)
// → LLM translation via /proxy (Gemma, strict-JSON prompt) → /api/tts playback.
// Tap RECORD again to stop. Works on touch and mouse; keyboard Z/X still work
// as a desktop bonus.

// Languages offered in each lane's dropdown; ttsLang selects the backend voice.
const AVAILABLE_LANGUAGES = [
  { code: "ar", name: "Arabic", voice: "tts", ttsLang: "ar" },
  { code: "en", name: "English", voice: "tts", ttsLang: "en" },
  { code: "es", name: "Spanish", voice: "tts", ttsLang: "es" },
  { code: "ja", name: "Japanese", voice: "tts", ttsLang: "ja" },
  { code: "zh", name: "Chinese", voice: "tts", ttsLang: "zh" },
  { code: "ko", name: "Korean", voice: "tts", ttsLang: "ko" },
]

// Persist a lane's language across page reloads.
function loadLangIndex(key, fallback) {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n >= AVAILABLE_LANGUAGES.length) {
    return fallback
  }
  return n
}

function TranslatorApp({ config }) {
  // UI State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activePerson, setActivePerson] = useState(1)

  // Translation State
  const [transcriptionData, setTranscriptionData] = useState({
    source: "",
    text: "— listening —",
  })
  const [translationData, setTranslationData] = useState({
    target: "",
    text: "— waiting —",
  })
  const [metaText, setMetaText] = useState("")

  // Currently-playing TTS audio element (chunked playback chain)
  const onlineAudioPlayerRef = useRef(null)

  // Language Lanes State (persisted)
  const [lang1Index, setLang1Index] = useState(() =>
    loadLangIndex("lang1Index", 0),
  )
  const [lang2Index, setLang2Index] = useState(() =>
    loadLangIndex("lang2Index", 1),
  )

  // Which lane is currently recording (1 or 2, or null).
  const [recordingLane, setRecordingLane] = useState(null)

  const { isRecording, startRecording, stopRecording, analyser, micError } =
    useAudioRecorder()

  // Persist language choices whenever they change.
  useEffect(() => {
    localStorage.setItem("lang1Index", String(lang1Index))
  }, [lang1Index])
  useEffect(() => {
    localStorage.setItem("lang2Index", String(lang2Index))
  }, [lang2Index])

  // Surface microphone errors in the drawer.
  useEffect(() => {
    if (micError) {
      setIsDrawerOpen(true)
      setTranscriptionData({ source: "Microphone", text: "Access Failed" })
      setTranslationData({
        target: "Error",
        text: `${micError} (HTTPS is required when accessing from remote devices)`,
      })
    }
  }, [micError])

  const stopSpeaking = useCallback(() => {
    if (onlineAudioPlayerRef.current) {
      onlineAudioPlayerRef.current.pause()
      onlineAudioPlayerRef.current = null
    }
  }, [])

  // Speak text via /api/tts, splitting into ~180-char chunks and chaining
  // playback so long translations don't overflow a single TTS request.
  const playTTS = useCallback(
    (text, targetLang) => {
      if (!text) return
      stopSpeaking()

      const chunks = splitTextIntoSpeechChunks(text)
      if (chunks.length === 0) return

      let chunkIndex = 0

      const playNextChunk = () => {
        if (chunkIndex >= chunks.length) {
          stopSpeaking()
          return
        }
        const ttsUrl = `/api/tts?text=${encodeURIComponent(chunks[chunkIndex])}&lang=${encodeURIComponent(targetLang)}`
        const player = new Audio(ttsUrl)
        player.volume = 1.0
        onlineAudioPlayerRef.current = player

        player.onended = () => {
          chunkIndex++
          playNextChunk()
        }
        player.onerror = () => {
          stopSpeaking()
          alert("TTS playback failed. Backend server may be offline.")
        }
        player.play().catch((e) => {
          console.error("Audio play error:", e)
          stopSpeaking()
        })
      }

      playNextChunk()
    },
    [stopSpeaking],
  )

  // Set a lane's language directly from its dropdown.
  const handleSelectLanguage = useCallback(
    (lane, newIndex) => {
      if (isRecording) return
      if (newIndex < 0 || newIndex >= AVAILABLE_LANGUAGES.length) return

      playBlip("language")

      if (lane === 1) {
        setLang1Index(newIndex)
      } else {
        setLang2Index(newIndex)
      }
    },
    [isRecording],
  )

  // Translation Pipeline (unchanged logic, kept in closure form).
  const processTranslation = useCallback(
    async (lane, base64Data) => {
      setIsDrawerOpen(true)

      const src =
        lane === 1
          ? AVAILABLE_LANGUAGES[lang1Index]
          : AVAILABLE_LANGUAGES[lang2Index]
      const dst =
        lane === 1
          ? AVAILABLE_LANGUAGES[lang2Index]
          : AVAILABLE_LANGUAGES[lang1Index]

      setTranscriptionData({
        source: `${src.name} (Source)`,
        text: "Analyzing voice input...",
      })
      setTranslationData({
        target: `${dst.name} (Translation)`,
        text: "Translating...",
      })
      setMetaText("")

      try {
        // 1. Transcription
        setTranscriptionData((prev) => ({ ...prev, text: "Listening..." }))
        const transcribedText = await transcribeAudio(base64Data, src.code)
        setTranscriptionData((prev) => ({ ...prev, text: transcribedText }))

        if (!transcribedText.trim()) {
          setTranslationData((prev) => ({
            ...prev,
            text: "(No speech detected)",
          }))
          return
        }

        // 2. Translation
        const result = await translateText(transcribedText, {
          ...config,
          modelName: config.modelName,
          systemPrompt: `You are a high-performance translator. Your task is to translate text from ${src.name.split(" ")[0]} into ${dst.name.split(" ")[0]}.\nYou MUST format your response as a valid JSON object matching this structure:\n{\n  "translation": "High-quality, natural translation into ${dst.name.split(" ")[0]}"\n}\nDo NOT return anything else except this JSON object. No Markdown block wraps (no \`\`\`json), no introductory text, no conversational text. Start directly with "{" and end directly with "}".`,
        })

        setTranslationData((prev) => ({ ...prev, text: result.translation }))
        setMetaText(`Duration: ${result.duration}s | Tokens: ${result.tokens}`)

        if (config.enableTts) {
          playTTS(result.translation, dst.ttsLang)
        }
      } catch (err) {
        console.error(err)
        setTranscriptionData((prev) => ({
          ...prev,
          text:
            prev.text === "Listening..."
              ? "(Transcription failed)"
              : prev.text,
        }))
        setTranslationData((prev) => ({
          ...prev,
          text: `Error: ${err.message}`,
        }))
      }
    },
    [config, lang1Index, lang2Index, playTTS],
  )

  // ─────────────────────────────────────────────────────────────
  // Recording toggle — tap once to start, tap again to stop
  // ─────────────────────────────────────────────────────────────
  const handleToggleRecord = useCallback(
    async (lane) => {
      // Stop case: same lane is recording → finalize
      if (isRecording && recordingLane === lane) {
        const recordedLane = recordingLane
        setRecordingLane(null)
        const audioData = await stopRecording()
        if (audioData) {
          processTranslation(recordedLane, audioData.base64Data)
        }
        return
      }

      // Start case: nothing recording (or a different lane somehow) → begin
      if (!isRecording) {
        stopSpeaking()
        setActivePerson(lane)
        playBlip("ping")

        const ok = await startRecording()
        if (ok) {
          setRecordingLane(lane)
        } else {
          setRecordingLane(null)
        }
      }
    },
    [
      isRecording,
      recordingLane,
      stopRecording,
      startRecording,
      stopSpeaking,
      processTranslation,
    ],
  )

  // ─────────────────────────────────────────────────────────────
  // Keyboard bonus (desktop): Z = lane 1 toggle, X = lane 2 toggle.
  // Inputs/selects are ignored so typing in settings works.
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return
      if (e.repeat) return
      const key = e.key.toLowerCase()

      if (key === "z") {
        e.preventDefault()
        handleToggleRecord(1)
      } else if (key === "x") {
        e.preventDefault()
        handleToggleRecord(2)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleToggleRecord])

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="translator-envelope">
      <ResponseDrawer
        isActive={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        transcriptionSource={transcriptionData.source}
        transcriptionText={transcriptionData.text}
        translationTarget={translationData.target}
        translationText={translationData.text}
        metaText={metaText}
      />

      <main className="translator-workspace">
        <div className="languages-container">
          <LanguageLane
            laneId={1}
            laneLabel="1"
            languages={AVAILABLE_LANGUAGES}
            currentIndex={lang1Index}
            isRecording={recordingLane === 1}
            isActivePerson={activePerson === 1}
            disabled={isRecording && recordingLane !== 1}
            onSelectLanguage={(idx) => handleSelectLanguage(1, idx)}
            onToggleRecord={() => handleToggleRecord(1)}
          />
          <LanguageLane
            laneId={2}
            laneLabel="2"
            languages={AVAILABLE_LANGUAGES}
            currentIndex={lang2Index}
            isRecording={recordingLane === 2}
            isActivePerson={activePerson === 2}
            disabled={isRecording && recordingLane !== 2}
            onSelectLanguage={(idx) => handleSelectLanguage(2, idx)}
            onToggleRecord={() => handleToggleRecord(2)}
          />
        </div>

        <Visualizer
          activePerson={activePerson}
          isRecording={isRecording}
          analyser={analyser}
          barsCount={parseInt(config.visualizerBars, 10)}
        />
      </main>
    </div>
  )
}

export default TranslatorApp