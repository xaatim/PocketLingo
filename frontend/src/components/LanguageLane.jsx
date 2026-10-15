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

import React from "react"

// One person's lane: a native language <select> dropdown plus a tap-to-toggle
// record button. Tap the button once to start recording, tap again to stop and
// translate. Both controls are touch-first and work with mouse too.
export default function LanguageLane({
  laneId,
  laneLabel,
  languages,
  currentIndex,
  isRecording,
  isActivePerson,
  disabled,
  onSelectLanguage,
  onToggleRecord,
}) {
  const handleSelectChange = (e) => {
    if (isRecording || disabled) return
    onSelectLanguage(Number(e.target.value))
  }

  const handleRecordClick = (e) => {
    e.preventDefault()
    if (disabled) return
    onToggleRecord()
  }

  return (
    <section
      className={`language-lane lane-${laneId === 1 ? "one" : "two"} ${isRecording ? "recording" : ""} ${isActivePerson ? "selected" : ""}`}
      id={`lane-${laneId}`}
    >
      <div className="lane-header">
        <span className="lane-label">{laneLabel}</span>
      </div>

      <select
        className="lang-select"
        value={currentIndex}
        onChange={handleSelectChange}
        disabled={isRecording || disabled}
        aria-label={`Language for person ${laneLabel}`}
      >
        {languages.map((l, i) => (
          <option key={l.code} value={i}>
            {l.name.toUpperCase()}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={`record-btn ${isRecording ? "recording" : ""}`}
        onClick={handleRecordClick}
        disabled={disabled}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        aria-pressed={isRecording}
      >
        <span className="rec-dot" aria-hidden="true"></span>
        {isRecording ? "STOP" : "RECORD"}
      </button>

      <div className="corner-brackets"></div>
    </section>
  )
  }