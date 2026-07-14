"""
Professional Video Editing Pipeline
Edits Apresentacao_inicial_sem_vinheta.mp4 with:
- Audio cleaning (noise reduction, compression, loudness normalization)
- VAD-based silence trimming
- Stutter removal via Whisper transcription
- Video re-encoding with dissolve transitions
"""

import os
import sys
import json
import time
import logging
import subprocess
import tempfile
import shutil
from pathlib import Path

# ─── ENSURE FFMPEG IS ON PATH ────────────────────────────────────────────────
_FFMPEG_DIR = r"C:\Program Files\DownloadHelper CoApp"
if _FFMPEG_DIR not in os.environ.get("PATH", ""):
    os.environ["PATH"] = _FFMPEG_DIR + ";" + os.environ.get("PATH", "")

# ─── CONFIG ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(r"C:\Users\16144-pedro\Documents\python_projects\gestaodeacesso")
INPUT_VIDEO = BASE_DIR / "Apresentacao_inicial_sem_vinheta.mp4"
OUTPUT_VIDEO = BASE_DIR / "Apresentacao_inicial_editado.mp4"
FFMPEG = r"C:\Program Files\DownloadHelper CoApp\ffmpeg.exe"
WORKDIR = BASE_DIR / "edit_tmp"
LOG_FILE = BASE_DIR / "edit_video.log"

SAMPLE_RATE = 16000  # whisper uses 16kHz

# ─── LOGGING ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(str(LOG_FILE), mode="w", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)


def ffmpeg(*args, check=True, capture=False):
    """Run ffmpeg with given args."""
    cmd = [FFMPEG] + list(str(a) for a in args)
    log.debug("ffmpeg: %s", " ".join(cmd))
    if capture:
        r = subprocess.run(cmd, capture_output=True, text=True)
        if check and r.returncode != 0:
            raise RuntimeError(f"ffmpeg error:\n{r.stderr}")
        return r
    else:
        r = subprocess.run(cmd, capture_output=True, text=True)
        if check and r.returncode != 0:
            log.error("ffmpeg stderr: %s", r.stderr[-2000:])
            raise RuntimeError(f"ffmpeg failed (code {r.returncode})")
        return r


def get_video_info(path):
    """Get video duration, fps, resolution."""
    r = ffmpeg(
        "-i", path, "-f", "null", "-",
        check=False, capture=True
    )
    output = r.stderr
    # parse duration
    import re
    dur_m = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", output)
    if not dur_m:
        raise RuntimeError("Could not parse video duration")
    h, m, s = int(dur_m.group(1)), int(dur_m.group(2)), float(dur_m.group(3))
    duration = h * 3600 + m * 60 + s

    fps_m = re.search(r"(\d+(?:\.\d+)?)\s*fps", output)
    fps = float(fps_m.group(1)) if fps_m else 25.0

    res_m = re.search(r"(\d{3,4})x(\d{3,4})", output)
    width = int(res_m.group(1)) if res_m else 1920
    height = int(res_m.group(2)) if res_m else 1080

    log.info("Video: %.2fs, %.2f fps, %dx%d", duration, fps, width, height)
    return {"duration": duration, "fps": fps, "width": width, "height": height}


# ─── STEP 1: EXTRACT AUDIO ───────────────────────────────────────────────────
def step1_extract_audio(workdir):
    log.info("=== STEP 1: Extracting audio ===")
    raw_audio = workdir / "audio_raw.wav"
    ffmpeg(
        "-y", "-i", INPUT_VIDEO,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", str(SAMPLE_RATE),
        "-ac", "1",
        str(raw_audio)
    )
    log.info("Audio extracted: %s", raw_audio)
    return raw_audio


# ─── STEP 2: AUDIO CLEANING ──────────────────────────────────────────────────
def step2_clean_audio(raw_audio, workdir):
    log.info("=== STEP 2: Audio cleaning ===")
    import numpy as np
    import soundfile as sf
    import noisereduce as nr
    import pyloudnorm as pyln
    from scipy import signal

    # Load audio
    audio, sr = sf.read(str(raw_audio))
    log.info("Loaded audio: %.2fs, sr=%d", len(audio)/sr, sr)

    # 2a. Spectral noise reduction — use first 0.5s as noise profile
    log.info("  Applying spectral noise reduction...")
    noise_profile = audio[:int(sr * 0.5)]
    audio_nr = nr.reduce_noise(
        y=audio,
        sr=sr,
        y_noise=noise_profile,
        prop_decrease=0.75,
        stationary=False,
    )

    # 2b. High-pass filter at 80 Hz
    log.info("  Applying high-pass filter at 80 Hz...")
    sos = signal.butter(4, 80, btype="highpass", fs=sr, output="sos")
    audio_hp = signal.sosfilt(sos, audio_nr)

    # 2c. Gentle compression (2:1 ratio, soft knee)
    log.info("  Applying gentle compression (2:1)...")
    threshold_db = -20.0
    ratio = 2.0
    knee_db = 6.0

    def compress(samples, threshold_db, ratio, knee_db):
        # Convert to dB, apply soft-knee compression
        eps = 1e-10
        db = 20 * np.log10(np.abs(samples) + eps)
        knee_start = threshold_db - knee_db / 2
        knee_end = threshold_db + knee_db / 2

        gain_db = np.zeros_like(db)
        # Below knee: no compression
        # In knee: smooth transition
        in_knee = (db >= knee_start) & (db < knee_end)
        above_knee = db >= knee_end

        gain_db[in_knee] = (
            (1/ratio - 1)
            * ((db[in_knee] - knee_start) ** 2)
            / (2 * knee_db)
        )
        gain_db[above_knee] = (
            (db[above_knee] - threshold_db) * (1/ratio - 1)
        )

        gain_linear = 10 ** (gain_db / 20)
        return samples * gain_linear

    audio_comp = compress(audio_hp, threshold_db, ratio, knee_db)

    # 2d. Normalize to -16 LUFS
    log.info("  Normalizing to -16 LUFS...")
    meter = pyln.Meter(sr)
    # pyloudnorm needs float64 and shape (samples,) or (samples, channels)
    audio_f64 = audio_comp.astype(np.float64)
    try:
        loudness = meter.integrated_loudness(audio_f64)
        log.info("  Current loudness: %.2f LUFS", loudness)
        if np.isfinite(loudness):
            audio_norm = pyln.normalize.loudness(audio_f64, loudness, -16.0)
        else:
            # Fallback: peak normalize
            peak = np.max(np.abs(audio_f64))
            audio_norm = audio_f64 * (0.9 / peak) if peak > 0 else audio_f64
    except Exception as e:
        log.warning("LUFS normalization failed (%s), using peak norm", e)
        peak = np.max(np.abs(audio_f64))
        audio_norm = audio_f64 * (0.9 / peak) if peak > 0 else audio_f64

    # Clip to [-1, 1]
    audio_norm = np.clip(audio_norm, -1.0, 1.0)

    # Save cleaned audio
    cleaned_audio = workdir / "audio_cleaned.wav"
    sf.write(str(cleaned_audio), audio_norm.astype(np.float32), sr)
    log.info("Cleaned audio saved: %s", cleaned_audio)
    return cleaned_audio


# ─── STEP 3: VAD ─────────────────────────────────────────────────────────────
def step3_vad(cleaned_audio, video_info, workdir):
    log.info("=== STEP 3: Voice Activity Detection ===")
    import numpy as np
    import soundfile as sf

    audio, sr = sf.read(str(cleaned_audio))
    duration = len(audio) / sr

    segments = None

    # Try silero-vad
    try:
        import torch
        log.info("  Loading Silero VAD model...")
        model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            force_reload=False,
            trust_repo=True,
        )
        (get_speech_timestamps, save_audio, read_audio,
         VADIterator, collect_chunks) = utils

        log.info("  Running Silero VAD...")
        wav = torch.tensor(audio, dtype=torch.float32)
        speech_timestamps = get_speech_timestamps(
            wav, model,
            sampling_rate=sr,
            threshold=0.5,
            min_speech_duration_ms=250,
            min_silence_duration_ms=200,
        )
        if speech_timestamps:
            segments = [
                (t["start"] / sr, t["end"] / sr)
                for t in speech_timestamps
            ]
            log.info("  Silero VAD found %d raw segments", len(segments))
        else:
            log.warning("  Silero VAD returned no segments")

    except Exception as e:
        log.warning("  Silero VAD failed: %s — falling back to energy VAD", e)

    # Fallback: energy-based VAD
    if not segments:
        log.info("  Using energy-based VAD fallback...")
        frame_len = int(sr * 0.02)  # 20ms frames
        hop = frame_len
        energies = []
        for i in range(0, len(audio) - frame_len, hop):
            frame = audio[i:i+frame_len]
            energies.append(np.sqrt(np.mean(frame**2)))

        energies = np.array(energies)
        threshold = np.percentile(energies, 30)  # bottom 30% = silence
        is_speech = energies > threshold

        segments = []
        in_speech = False
        seg_start = 0
        for i, s in enumerate(is_speech):
            t = i * hop / sr
            if s and not in_speech:
                seg_start = t
                in_speech = True
            elif not s and in_speech:
                segments.append((seg_start, t))
                in_speech = False
        if in_speech:
            segments.append((seg_start, duration))
        log.info("  Energy VAD found %d raw segments", len(segments))

    # Group segments separated by < 0.4s
    GAP_THRESHOLD = 0.4
    SILENCE_MAX = 0.5
    SILENCE_TARGET = 0.4

    merged = []
    for seg in segments:
        if merged and (seg[0] - merged[-1][1]) < GAP_THRESHOLD:
            merged[-1] = (merged[-1][0], seg[1])
        else:
            merged.append(list(seg))
    segments = merged
    log.info("  After merging (gap<%.1fs): %d segments", GAP_THRESHOLD, len(segments))

    # Build keep-timeline: trim silences > 0.5s to 0.4s
    # We'll build a list of (audio_start, audio_end) spans to keep
    timeline = []
    prev_end = 0.0

    for seg_start, seg_end in segments:
        gap = seg_start - prev_end
        if gap > SILENCE_MAX:
            # Keep only SILENCE_TARGET seconds of silence before this segment
            keep_start = seg_start - SILENCE_TARGET
            if keep_start < prev_end:
                keep_start = prev_end
            if keep_start > prev_end:
                # There's a gap we're skipping — just start from keep_start
                timeline.append((keep_start, seg_end))
            else:
                timeline.append((prev_end, seg_end))
        else:
            # Keep the gap as-is
            timeline.append((prev_end, seg_end))
        prev_end = seg_end

    # Add tail if any
    if prev_end < duration - 0.1:
        tail = min(duration, prev_end + SILENCE_TARGET)
        timeline.append((prev_end, tail))

    # Merge overlapping/adjacent spans in timeline
    clean_timeline = []
    for span in timeline:
        if clean_timeline and span[0] <= clean_timeline[-1][1] + 0.01:
            clean_timeline[-1] = (clean_timeline[-1][0], max(clean_timeline[-1][1], span[1]))
        else:
            clean_timeline.append(list(span))

    log.info("  Final VAD timeline: %d segments (%.2fs total)",
             len(clean_timeline),
             sum(e - s for s, e in clean_timeline))

    return clean_timeline, audio, sr


# ─── STEP 4: STUTTER REMOVAL ─────────────────────────────────────────────────
def step4_stutter_removal(cleaned_audio, vad_timeline, audio, sr, workdir):
    import re as _re
    log.info("=== STEP 4: Stutter removal via Whisper ===")

    word_segments = None
    transcript_path = workdir / "transcript.json"

    # Reuse existing transcript if available
    if transcript_path.exists():
        log.info("  Reusing existing transcript: %s", transcript_path)
        with open(str(transcript_path), encoding="utf-8") as f:
            word_segments = json.load(f)
        log.info("  Loaded %d words from transcript", len(word_segments))
    else:
        # Try native Whisper with word timestamps (ffmpeg now in PATH)
        try:
            import whisper
            log.info("  Loading Whisper small model (CPU)...")
            model = whisper.load_model("small")
            log.info("  Transcribing %s (language=pt)...", cleaned_audio.name)
            result = model.transcribe(
                str(cleaned_audio),
                language="pt",
                word_timestamps=True,
                verbose=False,
            )
            word_segments = []
            for seg in result.get("segments", []):
                for w in seg.get("words", []):
                    word_segments.append({
                        "word": w.get("word", "").strip().lower(),
                        "start": float(w.get("start", 0)),
                        "end": float(w.get("end", 0)),
                    })
            log.info("  Whisper transcribed %d words", len(word_segments))
            # Save transcript
            with open(str(transcript_path), "w", encoding="utf-8") as f:
                json.dump(word_segments, f, ensure_ascii=False, indent=2)
            log.info("  Transcript saved: %s", transcript_path)
        except Exception as e:
            log.warning("  Whisper failed: %s — skipping stutter removal", e)

    if not word_segments:
        log.info("  No word segments; skipping stutter removal")
        return vad_timeline, []

    # Detect consecutive identical words within 0.6s
    DUPLICATE_WINDOW = 0.6
    CROSSFADE = 0.03  # 30ms crossfade around cut points

    cuts = []
    i = 0
    while i < len(word_segments) - 1:
        w = word_segments[i]
        j = i + 1
        while j < len(word_segments):
            nw = word_segments[j]
            if nw["start"] - w["end"] > DUPLICATE_WINDOW:
                break
            w_clean = _re.sub(r"[^\w]", "", w["word"])
            nw_clean = _re.sub(r"[^\w]", "", nw["word"])
            if w_clean and nw_clean and w_clean == nw_clean:
                cut_start = max(0.0, nw["start"] - CROSSFADE)
                cut_end = nw["end"] + CROSSFADE
                cuts.append((cut_start, cut_end))
                log.info("  Stutter: '%s' @%.2f-%.2f (dup of @%.2f-%.2f)",
                         w["word"], nw["start"], nw["end"], w["start"], w["end"])
                j += 1
            else:
                break
        i = j if j > i + 1 else i + 1

    if not cuts:
        log.info("  No stutters detected")
        return vad_timeline, []

    log.info("  Found %d stutter cuts", len(cuts))

    def subtract_intervals(spans, removals):
        result = []
        for (s, e) in spans:
            current = [(s, e)]
            for (cs, ce) in removals:
                new_current = []
                for (a, b) in current:
                    if ce <= a or cs >= b:
                        new_current.append((a, b))
                    elif cs <= a and ce >= b:
                        pass
                    elif cs <= a:
                        new_current.append((ce, b))
                    elif ce >= b:
                        new_current.append((a, cs))
                    else:
                        new_current.append((a, cs))
                        new_current.append((ce, b))
                current = new_current
            result.extend(current)
        return result

    new_timeline = subtract_intervals(vad_timeline, cuts)
    log.info("  After stutter removal: %d segments", len(new_timeline))
    return new_timeline, cuts


# ─── STEP 5 & 6: VIDEO CUTTING AND RE-ENCODING ───────────────────────────────
def get_seg_duration(ffmpeg_path, filepath):
    import re
    r = subprocess.run(
        [ffmpeg_path, "-i", str(filepath), "-f", "null", "-"],
        capture_output=True, text=True, errors="replace"
    )
    dm = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", r.stderr)
    if dm:
        h, m, s = int(dm.group(1)), int(dm.group(2)), float(dm.group(3))
        return h*3600 + m*60 + s
    return 0.0


def step5_cut_and_encode(final_timeline, video_info, workdir):
    log.info("=== STEP 5: Video cutting and re-encoding ===")
    import re

    if not final_timeline:
        raise RuntimeError("Empty timeline — nothing to encode!")

    duration = video_info["duration"]

    # Clamp timeline to valid range
    final_timeline = [
        (max(0, s), min(duration, e))
        for s, e in final_timeline
        if e - s > 0.1  # drop very short segments
    ]

    total_duration = sum(e - s for s, e in final_timeline)
    log.info("  Total output duration: %.2fs (%d segments)", total_duration, len(final_timeline))

    DISSOLVE_V = 0.1   # 0.1s video dissolve
    CROSSFADE_A = 0.05  # 0.05s audio crossfade

    segments_dir = workdir / "segments"
    segments_dir.mkdir(exist_ok=True)

    # ── Extract each segment as a losslessly-trimmed intermediate ──
    # Use -vf format=yuv420p to ensure consistent pixel format
    seg_files = []
    log.info("  Extracting %d video segments...", len(final_timeline))

    for idx, (seg_start, seg_end) in enumerate(final_timeline):
        seg_dur = seg_end - seg_start
        if seg_dur < 0.1:
            continue
        out_seg = segments_dir / f"seg_{idx:04d}.mp4"
        ffmpeg(
            "-y",
            "-ss", f"{seg_start:.6f}",
            "-i", INPUT_VIDEO,
            "-t", f"{seg_dur:.6f}",
            "-c:v", "libx264",
            "-crf", "18",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-ar", "44100",
            "-ac", "2",
            "-b:a", "192k",
            "-avoid_negative_ts", "make_zero",
            str(out_seg)
        )
        if out_seg.exists() and out_seg.stat().st_size > 1000:
            seg_files.append(str(out_seg))
        else:
            log.warning("  Segment %d appears empty, skipping", idx)

        if (idx + 1) % 5 == 0 or (idx + 1) == len(final_timeline):
            log.info("    Extracted %d/%d segments...", idx+1, len(final_timeline))

    log.info("  Extracted %d segments", len(seg_files))

    if len(seg_files) == 0:
        raise RuntimeError("No segments extracted!")

    if len(seg_files) == 1:
        shutil.copy(seg_files[0], str(OUTPUT_VIDEO))
        log.info("  Single segment — copied to output")
        return

    n = len(seg_files)

    # ── Strategy: Use filter_complex with xfade (video) chained correctly ──
    # For audio: use amix or just concat — acrossfade requires sequential streams
    # The correct approach for dissolve on N clips:
    # - For VIDEO: chain xfade filters; offset = sum(dur[0..i-1]) - i*dissolve_dur
    # - For AUDIO: use concat filter (no crossfade, just join), or do audio separately
    #
    # NOTE: acrossfade collapses timeline because it outputs the merged stream length,
    # not the sum. For clean concatenation with short crossfades, use the concat filter
    # which is reliable. For dissolve-only video with audio concat:

    # Get all segment durations first
    seg_durations = []
    log.info("  Measuring segment durations...")
    for f in seg_files:
        d = get_seg_duration(FFMPEG, f)
        seg_durations.append(d)
        log.debug("  %s: %.3fs", f, d)

    # ── Approach: Two-pass
    # Pass 1: concat all audio (no crossfade) using concat filter — guaranteed correct
    # Pass 2: chain xfade dissolves for video
    # Then mux video + audio
    #
    # Actually, the cleanest approach for reliability with 13 segments:
    # Use concat demuxer for a first pass, then apply dissolves via filter_complex
    # on the single concatenated file using overlay/blend at known timestamps.
    #
    # Even simpler and more reliable: Use the concat FILTER (not demuxer) for both
    # video and audio. It creates clean cuts (no dissolve) but is 100% reliable.
    # Then apply a separate dissolve pass on the concatenated result.
    #
    # MOST RELIABLE: concat demuxer → concatenated video → apply xfade at seam timestamps

    # Step A: concat all segments with demuxer (simple, reliable)
    concat_file = workdir / "concat.txt"
    with open(str(concat_file), "w", encoding="utf-8") as f:
        for seg in seg_files:
            # Use forward slashes and escape
            seg_escaped = seg.replace("\\", "/").replace("'", "\\'")
            f.write(f"file '{seg_escaped}'\n")

    concatenated = workdir / "concatenated.mp4"
    log.info("  Step A: Concatenating %d segments with concat demuxer...", n)
    ffmpeg(
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_file),
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-ar", "44100",
        "-ac", "2",
        "-b:a", "192k",
        "-movflags", "+faststart",
        str(concatenated)
    )
    actual_concat_dur = get_seg_duration(FFMPEG, concatenated)
    log.info("  Concatenated: %.2fs", actual_concat_dur)

    # Step B: Apply xfade dissolves at seam timestamps via filter_complex on the concat
    # Seam timestamps (in the concatenated timeline)
    seam_times = []
    t = 0.0
    for i, d in enumerate(seg_durations[:-1]):
        t += d
        seam_times.append(t)

    log.info("  Step B: Applying %d dissolve transitions...", len(seam_times))

    # Build a filter_complex that applies xfade at each seam
    # We need N-1 xfade filters applied in sequence.
    # xfade offset is the time in the OUTPUT stream where the dissolve starts
    # After each xfade, the output shrinks by DISSOLVE_V seconds.
    filter_v_parts = []
    v_in = "[0:v]"
    # We need to split the single input into N parts using trim/setpts
    # But xfade on a single input requires a different approach.
    #
    # Alternative: use the -loop trick or generate the seams differently.
    # SIMPLEST correct approach for a single source:
    # Use a split + trim approach:
    #
    # split into segments around each seam, then chain xfade.
    # This is complex. Let's use a simpler but correct method:
    # Apply all dissolves using a sequence of overlay+blend at exact timestamps.
    #
    # PRAGMATIC: For 13 seams with 0.1s dissolve, just use the concat result
    # and apply a fast dissolve via a custom approach.

    # Build xfade filter on the concatenated file using split and trim:
    # For each seam at time T, we want a dissolve [T-dissolve, T+dissolve] between
    # the content just before T and just after T.
    # This means: trim before T-eps, dissolve with content around T.
    #
    # The cleanest ffmpeg approach: split, trim each pair around the seam, xfade, concat all.
    # For N seams, this creates N+1 blocks around each seam.

    if len(seam_times) <= 20:
        # Build multi-split dissolve filter on the concatenated file
        # Seam blocks: [0, seam0-dissolve], dissolve@seam0, [seam0+dissolve, seam1-dissolve], ...
        d = DISSOLVE_V

        # Build trim segments
        blocks = []
        prev_end = 0.0
        for seam in seam_times:
            a = seam - d
            b = seam + d
            if a > prev_end + 0.01:
                blocks.append(("plain", prev_end, a))
            blocks.append(("dissolve", a - d, b))  # overlap window
            prev_end = b
        if prev_end < actual_concat_dur - 0.01:
            blocks.append(("plain", prev_end, actual_concat_dur))

        # Actually this approach gets complicated quickly. Let's use the proven simple method:
        # Just build the filter using a single input with multiple xfade filters applied
        # directly on the concatenated file, using the correct offsets.
        #
        # Each xfade on a single-stream input uses offset relative to the OUTPUT timeline.
        # After the first xfade (dissolve duration D at offset O1):
        #   - Output before O1: passthrough
        #   - Dissolve: [O1, O1+D] (using frames from [O1, O1+D] and [O1+D, O1+2D] of input)
        #   - Output after: continues from O1+2D in input
        # This means output is D shorter.
        # For the next seam, its position in the output shifts by -D.
        #
        # This only works if we're applying to a SINGLE stream with xfade using two inputs.
        # xfade requires two separate input streams.
        #
        # FINAL DECISION: Use trim+setpts split approach for correctness.
        # Split the concat file into per-seam blocks, apply xfade between adjacent blocks.

        log.info("  Building xfade filter for %d dissolves...", len(seam_times))

        # Split concat into N+1 chunk segments (before/after each seam)
        chunk_files = []
        chunk_dir = workdir / "chunks"
        chunk_dir.mkdir(exist_ok=True)

        chunk_points = [0.0] + seam_times + [actual_concat_dur]

        for ci in range(len(chunk_points) - 1):
            cs = chunk_points[ci]
            ce = chunk_points[ci + 1]
            cdur = ce - cs
            if cdur < 0.05:
                log.warning("  Chunk %d too short (%.3fs), skipping", ci, cdur)
                continue
            chunk_out = chunk_dir / f"chunk_{ci:04d}.mp4"
            ffmpeg(
                "-y",
                "-ss", f"{cs:.6f}",
                "-i", str(concatenated),
                "-t", f"{cdur:.6f}",
                "-c:v", "libx264", "-crf", "18", "-preset", "ultrafast",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "192k",
                "-avoid_negative_ts", "make_zero",
                str(chunk_out)
            )
            chunk_files.append(str(chunk_out))

        log.info("  Split into %d chunks for xfade", len(chunk_files))

        if len(chunk_files) <= 1:
            # Fallback: just use concatenated
            shutil.copy(str(concatenated), str(OUTPUT_VIDEO))
            log.info("  Only 1 chunk — using concatenated as output")
            return

        # Now chain xfade between adjacent chunks
        chunk_durations = [get_seg_duration(FFMPEG, f) for f in chunk_files]

        nc = len(chunk_files)
        inputs_cmd = []
        for f in chunk_files:
            inputs_cmd += ["-i", f]

        # Build xfade chain
        # Correct offset formula for chained xfade:
        # offset_k = sum(d[0..k-1]) - k * DISSOLVE_V
        # This places the dissolve at the join between chunk k-1 and chunk k
        # in the OUTPUT stream of all previous xfades.
        filter_v = []
        filter_a = []
        v_cur = "[0:v]"
        a_cur = "[0:a]"
        cum_d = 0.0  # cumulative sum of chunk durations

        for ci in range(1, nc):
            cum_d += chunk_durations[ci - 1]
            k = ci  # 1-indexed xfade number
            xf_offset = cum_d - k * DISSOLVE_V
            xf_offset = max(0.0, xf_offset)
            out_v = f"[xv{ci}]"
            out_a = f"[xa{ci}]"

            filter_v.append(
                f"{v_cur}[{ci}:v]xfade=transition=dissolve:"
                f"duration={DISSOLVE_V}:offset={xf_offset:.6f}{out_v}"
            )
            filter_a.append(
                f"{a_cur}[{ci}:a]acrossfade=d={CROSSFADE_A}:c1=tri:c2=tri{out_a}"
            )

            v_cur = out_v
            a_cur = out_a

        filter_complex = ";".join(filter_v + filter_a)

        cmd = (
            inputs_cmd
            + ["-y",
               "-filter_complex", filter_complex,
               "-map", v_cur,
               "-map", a_cur,
               "-c:v", "libx264", "-crf", "18", "-preset", "fast",
               "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "192k",
               "-movflags", "+faststart",
               str(OUTPUT_VIDEO)]
        )

        log.info("  Final encode with %d xfade dissolves...", nc - 1)
        try:
            ffmpeg(*cmd)
            log.info("  Xfade encode succeeded")
        except Exception as e:
            log.warning("  Xfade encode failed (%s) — falling back to simple concat", e)
            shutil.copy(str(concatenated), str(OUTPUT_VIDEO))
            log.info("  Used concatenated (no dissolves) as fallback")

    else:
        # Too many seams — just use the clean concat
        log.info("  Too many seams (%d) — using clean concat output", len(seam_times))
        shutil.copy(str(concatenated), str(OUTPUT_VIDEO))

    log.info("  Output written: %s", OUTPUT_VIDEO)


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    start_time = time.time()
    log.info("=== VIDEO EDITING PIPELINE START ===")
    log.info("Input:  %s", INPUT_VIDEO)
    log.info("Output: %s", OUTPUT_VIDEO)

    if not INPUT_VIDEO.exists():
        log.error("Input file not found: %s", INPUT_VIDEO)
        sys.exit(1)

    # Create working directory
    WORKDIR.mkdir(exist_ok=True)

    # Get video info
    video_info = get_video_info(INPUT_VIDEO)

    # Step 1: Extract audio (reuse if exists)
    raw_audio = WORKDIR / "audio_raw.wav"
    if raw_audio.exists():
        log.info("  Reusing existing raw audio: %s", raw_audio)
    else:
        raw_audio = step1_extract_audio(WORKDIR)

    # Step 2: Clean audio (reuse if exists)
    cleaned_audio = WORKDIR / "audio_cleaned.wav"
    if cleaned_audio.exists():
        log.info("  Reusing existing cleaned audio: %s", cleaned_audio)
    else:
        cleaned_audio = step2_clean_audio(raw_audio, WORKDIR)

    # Step 3: VAD (reuse if final_timeline.json exists)
    vad_timeline_path = WORKDIR / "vad_timeline.json"
    if vad_timeline_path.exists():
        log.info("  Reusing existing VAD timeline")
        with open(vad_timeline_path) as f:
            data = json.load(f)
        vad_timeline = [tuple(x) for x in data]
        import numpy as np
        import soundfile as sf
        audio, sr = sf.read(str(cleaned_audio))
    else:
        vad_timeline, audio, sr = step3_vad(cleaned_audio, video_info, WORKDIR)
        with open(str(vad_timeline_path), "w") as f:
            json.dump([[s, e] for s, e in vad_timeline], f, indent=2)

    # Step 4: Stutter removal
    import numpy as np
    import soundfile as sf
    if not (WORKDIR / "audio_cleaned.wav").exists():
        audio, sr = sf.read(str(cleaned_audio))

    final_timeline, stutter_cuts = step4_stutter_removal(
        cleaned_audio, vad_timeline, audio, sr, WORKDIR
    )

    # Save timeline for reference
    timeline_path = WORKDIR / "final_timeline.json"
    with open(timeline_path, "w") as f:
        json.dump({
            "vad_timeline": [[s, e] for s, e in vad_timeline],
            "stutter_cuts": [[s, e] for s, e in stutter_cuts],
            "final_timeline": [[s, e] for s, e in final_timeline],
            "total_duration": sum(e-s for s, e in final_timeline),
            "original_duration": video_info["duration"],
        }, f, indent=2)
    log.info("Timeline saved: %s", timeline_path)

    # Step 5 & 6: Cut and encode
    step5_cut_and_encode(final_timeline, video_info, WORKDIR)

    elapsed = time.time() - start_time
    log.info("=== PIPELINE COMPLETE in %.1fs ===", elapsed)
    log.info("Output: %s", OUTPUT_VIDEO)

    if OUTPUT_VIDEO.exists():
        size_mb = OUTPUT_VIDEO.stat().st_size / (1024 * 1024)
        log.info("Output size: %.1f MB", size_mb)
        out_dur = get_seg_duration(FFMPEG, OUTPUT_VIDEO)
        log.info("Output duration: %.2fs (original: %.2fs, saved: %.2fs)",
                 out_dur, video_info["duration"], video_info["duration"] - out_dur)
    else:
        log.error("OUTPUT FILE NOT FOUND — something went wrong")


if __name__ == "__main__":
    main()
