package com.vega

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.DataReader
import androidx.media3.common.Format
import androidx.media3.common.util.ParsableByteArray
import androidx.media3.extractor.DefaultExtractorInput
import androidx.media3.extractor.Extractor
import androidx.media3.extractor.ExtractorOutput
import androidx.media3.extractor.PositionHolder
import androidx.media3.extractor.SeekMap
import androidx.media3.extractor.TrackOutput
import androidx.media3.extractor.mkv.MatroskaExtractor
import com.vega.MkvCueIndex.SubtitleLine
import java.io.ByteArrayOutputStream
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.util.Locale

/** Extracts a selected embedded text track only when a receiver requests it. */
internal object EmbeddedSubtitleVtt {
    private const val DEFAULT_LINE_US = 4_000_000L

    /** Shared with track inspection so subtitle ordinals mean the same track on both sides. */
    fun isSubtitleMime(rawMime: String): Boolean {
        val mime = rawMime.lowercase(Locale.US)
        return mime.startsWith("text/") ||
            mime.startsWith("subtitles/") ||
            mime.contains("subrip") ||
            mime.contains("ssa") ||
            mime.contains("ass") ||
            mime.contains("ttml") ||
            mime.contains("tx3g") ||
            mime.contains("pgs") ||
            mime.contains("vobsub") ||
            mime.contains("cea-608") ||
            mime.contains("cea-708")
    }

    /**
     * All lines of the [ordinal]-th subtitle track, in source time.
     *
     * The MKV Cue index is tried first: it points at every subtitle block, so only
     * those few bytes are read. A remote file without that index is refused rather
     * than read end to end, which would download the whole film. Local files may
     * be read fully, since that costs no data.
     */
    fun loadLines(context: Context, source: String, local: Boolean, headers: Map<String, String>, ordinal: Int): List<SubtitleLine> {
        val indexed = MkvCueIndex.readSubtitleLines(context, source, local, headers, ordinal)
            ?.mapNotNull { line -> cleanText(line.text).takeIf { it.isNotBlank() }?.let { SubtitleLine(line.startUs, line.endUs, it) } }
        if (!indexed.isNullOrEmpty()) return indexed
        val isRemote = !local && (source.startsWith("http://") || source.startsWith("https://"))
        if (isRemote) {
            throw IllegalStateException("This subtitle track is not indexed in the file; loading it would download the whole video")
        }
        return extractLocal(context, source, local, headers, ordinal)
    }

    private val CUE_TIMING = Regex(
        """((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})"""
    )

    /** Parses SRT, WebVTT, ASS or SSA into source-time cues for rebasing. */
    fun parseText(body: String): List<SubtitleLine> {
        if (body.lineSequence().any { it.trim().equals("[Events]", ignoreCase = true) }) {
            return parseAss(body)
        }
        val lines = mutableListOf<SubtitleLine>()
        val blocks = body.replace("\r\n", "\n").replace('\r', '\n').trimStart('﻿').split(Regex("\n{2,}"))
        for (block in blocks) {
            val rows = block.split('\n')
            val timingIndex = rows.indexOfFirst { CUE_TIMING.containsMatchIn(it) }
            if (timingIndex < 0) continue
            val match = CUE_TIMING.find(rows[timingIndex]) ?: continue
            val text = rows.drop(timingIndex + 1).joinToString("\n").trim()
            if (text.isEmpty()) continue
            val start = parseTimestampUs(match.groupValues[1]) ?: continue
            val end = parseTimestampUs(match.groupValues[2])
            lines.add(SubtitleLine(start, end, text))
        }
        return lines.sortedBy { it.startUs }
    }

    private fun parseAss(body: String): List<SubtitleLine> {
        var inEvents = false
        var fields = listOf("layer", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text")
        val lines = mutableListOf<SubtitleLine>()
        for (raw in body.lineSequence()) {
            val row = raw.trim().trimStart('\uFEFF')
            if (row.startsWith("[")) {
                inEvents = row.equals("[Events]", ignoreCase = true)
                continue
            }
            if (!inEvents) continue
            if (row.startsWith("Format:", ignoreCase = true)) {
                fields = row.substringAfter(':').split(',').map { it.trim().lowercase(Locale.US) }
                continue
            }
            if (!row.startsWith("Dialogue:", ignoreCase = true)) continue
            // Text is the final field and may itself contain commas.
            if (fields.lastOrNull() != "text") continue
            val values = row.substringAfter(':').split(',', limit = fields.size)
            if (values.size != fields.size) continue
            val start = values.getOrNull(fields.indexOf("start"))?.trim()?.let { parseTimestampUs(it) } ?: continue
            val end = values.getOrNull(fields.indexOf("end"))?.trim()?.let { parseTimestampUs(it) } ?: continue
            if (end <= start) continue
            val text = cleanText(values.last())
                .replace("\\n", "\n")
                .replace("\\h", "\u00A0")
            if (text.isNotBlank()) lines.add(SubtitleLine(start, end, text))
        }
        return lines.sortedBy { it.startUs }
    }

    private fun parseTimestampUs(value: String): Long? {
        val parts = value.replace(',', '.').split(':')
        val seconds = parts.last().toDoubleOrNull() ?: return null
        val minutes = parts.getOrNull(parts.size - 2)?.toLongOrNull() ?: return null
        val hours = if (parts.size == 3) parts[0].toLongOrNull() ?: return null else 0L
        return ((hours * 3600 + minutes * 60) * 1_000_000L) + (seconds * 1_000_000.0).toLong()
    }

    /** WebVTT for [lines], rebased so [offsetUs] of source time is 0 in the packaged stream. */
    fun toVtt(lines: List<SubtitleLine>, offsetUs: Long): String = buildString {
        append("WEBVTT\n\n")
        lines.forEachIndexed { index, line ->
            val next = lines.getOrNull(index + 1)?.startUs ?: Long.MAX_VALUE
            val end = (line.endUs ?: minOf(next, line.startUs + DEFAULT_LINE_US))
                .coerceAtLeast(line.startUs + 1_000L)
            if (end <= offsetUs) return@forEachIndexed
            val start = (line.startUs - offsetUs).coerceAtLeast(0L)
            append(formatTime(start)).append(" --> ").append(formatTime(end - offsetUs)).append('\n')
            append(line.text).append("\n\n")
        }
    }

    /** SRT for [lines], rebased so [offsetUs] of source time is 0 in the packaged stream. */
    fun toSrt(lines: List<SubtitleLine>, offsetUs: Long): String = buildString {
        var count = 1
        lines.forEachIndexed { index, line ->
            val next = lines.getOrNull(index + 1)?.startUs ?: Long.MAX_VALUE
            val end = (line.endUs ?: minOf(next, line.startUs + DEFAULT_LINE_US))
                .coerceAtLeast(line.startUs + 1_000L)
            if (end <= offsetUs) return@forEachIndexed
            val start = (line.startUs - offsetUs).coerceAtLeast(0L)
            val startTimeStr = formatTime(start).replace('.', ',')
            val endTimeStr = formatTime(end - offsetUs).replace('.', ',')
            append(count++).append('\n')
            append(startTimeStr).append(" --> ").append(endTimeStr).append('\n')
            append(line.text).append("\n\n")
        }
    }

    private fun extractLocal(context: Context, source: String, local: Boolean, headers: Map<String, String>, ordinal: Int): List<SubtitleLine> {
        val extractor = MediaExtractor()
        var descriptor: android.os.ParcelFileDescriptor? = null
        try {
            when {
                source.startsWith("content://") -> {
                    descriptor = context.contentResolver.openFileDescriptor(Uri.parse(source), "r")
                        ?: throw IllegalArgumentException("Cannot open video for subtitles")
                    extractor.setDataSource(descriptor.fileDescriptor)
                }
                local || source.startsWith("file://") || source.startsWith("/") ->
                    extractor.setDataSource(source.removePrefix("file://"))
                else -> extractor.setDataSource(source, headers)
            }
            val candidates = (0 until extractor.trackCount).filter { index ->
                isSubtitleMime(extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME) ?: "")
            }
            val track = candidates.getOrNull(ordinal)
                ?: return extractLocalMatroska(context, source, ordinal)
            val mime = extractor.getTrackFormat(track).getString(MediaFormat.KEY_MIME)?.lowercase(Locale.US) ?: ""
            require(!mime.contains("pgs") && !mime.contains("vobsub")) {
                "Image subtitles require bitmap conversion"
            }
            extractor.selectTrack(track)
            val buffer = ByteBuffer.allocate(1024 * 1024)
            val lines = ArrayList<SubtitleLine>()
            while (true) {
                buffer.clear()
                val size = extractor.readSampleData(buffer, 0)
                if (size < 0) break
                if (size > buffer.capacity()) throw IllegalStateException("Subtitle cue is too large")
                val timeUs = extractor.sampleTime
                if (timeUs >= 0 && extractor.sampleTrackIndex == track) {
                    val bytes = ByteArray(size)
                    buffer.position(0)
                    buffer.get(bytes)
                    val text = cleanText(String(bytes, Charsets.UTF_8))
                    if (text.isNotBlank()) lines.add(SubtitleLine(timeUs, null, text))
                }
                if (lines.size > 100_000 || !extractor.advance()) break
            }
            if (lines.isEmpty()) return extractLocalMatroska(context, source, ordinal)
            return lines
        } finally {
            extractor.release()
            descriptor?.close()
        }
    }

    /** Local files only: reads the whole MKV with Media3 to collect raw subtitle samples. */
    private fun extractLocalMatroska(context: Context, source: String, ordinal: Int): List<SubtitleLine> {
        val input = when {
            source.startsWith("content://") -> context.contentResolver.openInputStream(Uri.parse(source))
            else -> FileInputStream(source.removePrefix("file://"))
        } ?: throw IllegalArgumentException("Cannot open MKV subtitles")
        input.use {
            val selected = ArrayList<SubtitleLine>()
            var textOrdinal = 0
            val output = object : ExtractorOutput {
                override fun track(id: Int, type: Int): TrackOutput {
                    val current = if (type == C.TRACK_TYPE_TEXT) textOrdinal++ else -1
                    return object : TrackOutput {
                        private val pending = ByteArrayOutputStream()
                        override fun format(format: Format) = Unit
                        override fun sampleData(reader: DataReader, length: Int, allowEndOfInput: Boolean, sampleDataPart: Int): Int {
                            val bytes = ByteArray(minOf(length, 64 * 1024))
                            val count = reader.read(bytes, 0, bytes.size)
                            if (count > 0 && current == ordinal) pending.write(bytes, 0, count)
                            return count
                        }
                        override fun sampleData(data: ParsableByteArray, length: Int, sampleDataPart: Int) {
                            val bytes = ByteArray(length)
                            data.readBytes(bytes, 0, length)
                            if (current == ordinal) pending.write(bytes)
                        }
                        override fun sampleMetadata(timeUs: Long, flags: Int, size: Int, offset: Int, cryptoData: TrackOutput.CryptoData?) {
                            if (current == ordinal && timeUs >= 0) {
                                val bytes = pending.toByteArray()
                                val start = (bytes.size - offset - size).coerceAtLeast(0)
                                val end = (start + size).coerceAtMost(bytes.size)
                                val text = cleanText(String(bytes, start, end - start, Charsets.UTF_8))
                                if (text.isNotBlank()) selected.add(SubtitleLine(timeUs, null, text))
                                pending.reset()
                                if (offset > 0 && offset <= bytes.size) pending.write(bytes, bytes.size - offset, offset)
                            }
                        }
                    }
                }
                override fun endTracks() = Unit
                override fun seekMap(seekMap: SeekMap) = Unit
            }
            val extractor = MatroskaExtractor(
                MatroskaExtractor.FLAG_DISABLE_SEEK_FOR_CUES or MatroskaExtractor.FLAG_EMIT_RAW_SUBTITLE_DATA)
            extractor.init(output)
            val reader = DataReader { buffer, offset, length -> input.read(buffer, offset, length) }
            val extractorInput = DefaultExtractorInput(reader, 0, -1L)
            val position = PositionHolder()
            while (true) {
                when (extractor.read(extractorInput, position)) {
                    Extractor.RESULT_END_OF_INPUT -> break
                    Extractor.RESULT_SEEK -> throw IllegalStateException("MKV subtitle extraction requested an unsupported seek")
                }
                if (selected.size > 100_000) throw IllegalStateException("Too many subtitle cues")
            }
            extractor.release()
            require(selected.isNotEmpty()) { "Selected embedded track contains no text subtitles" }
            return selected
        }
    }

    private fun cleanText(value: String): String {
        val raw = value.trim('\u0000', '﻿', ' ', '\n', '\r')
        val dialogue = if (raw.startsWith("Dialogue:", ignoreCase = true))
            raw.substringAfter(':').split(',', limit = 10).lastOrNull().orEmpty()
        else raw
        return dialogue.lines()
            .dropWhile { it.trim().matches(Regex("[0-9]+")) || it.contains("-->") }
            .joinToString("\n")
            // ASS override tags like {\an8}. Android's ICU regex rejects an unescaped '}'.
            .replace(Regex("\\{\\\\[^\\}]*\\}"), "")
            .replace("\\N", "\n")
            .trim()
    }

    private fun formatTime(us: Long): String {
        val ms = us / 1000
        return "%02d:%02d:%02d.%03d".format(Locale.US,
            ms / 3_600_000, (ms / 60_000) % 60, (ms / 1000) % 60, ms % 1000)
    }
}
