package com.vega

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Log
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.util.UnstableApi
import androidx.media3.muxer.BufferInfo
import androidx.media3.muxer.FragmentedMp4Muxer
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.nio.ByteBuffer
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock

/**
 * Remuxes one video track and one selected audio track into a fragmented MP4,
 * building each fragment only when a reader reaches it. No whole-film copy is made.
 *
 * Indexed mode (MKV Cues present): fragments follow the Cue keyframes, so any
 * fragment can be built out of order. With Cue cluster positions the file layout
 * is fixed up front and byte ranges are served ([supportsByteRanges]).
 *
 * Sequential mode (no Cues): fragments are cut at keyframes in order from the
 * requested start; the stream can only be read from its beginning.
 *
 * Receivers open several connections at different positions. Each position is
 * served by its own extractor [Cursor] (up to [MAX_CURSORS]) so readers do not drag
 * one extractor back and forth, and built fragments stay in a small LRU cache.
 */
@OptIn(UnstableApi::class)
class OnDemandMp4Packager(
    private val context: Context,
    private val sourceUrl: String,
    private val isLocal: Boolean,
    private val headers: Map<String, String>,
    private val audioOrdinal: Int,
    private val requestedStartSeconds: Double = 0.0
) {
    companion object {
        private const val TAG = "OnDemandMp4Packager"
        private const val SEQUENTIAL_SEGMENT_US = 6_000_000L
        private const val MAX_SEGMENT_US = 30_000_000L
        private const val AHEAD_SEGMENTS = 5
        private const val INITIAL_SEGMENTS = 2
        private const val MAX_CURSORS = 3
        // ~2 MB per 4 s fragment of 1080p: about 120 MB of disk at most.
        private const val MAX_CACHED_SEGMENTS = 60
        // Receivers leave old connections reading after a seek (e.g. from 0:00 while
        // playing at 15:00). A reader far from the newest one is served from cache only
        // and cut off at its first uncached fragment. Chrome keeps several overlapping
        // requests near one position; those stay within this distance and keep building.
        private const val NEARBY_SEGMENTS = 15
        // Audio/video interleave step inside each fragment's mdat.
        private const val INTERLEAVE_SECONDS = 0.5
    }

    private val readerGeneration = java.util.concurrent.atomic.AtomicLong()
    // Open byte-range reader -> the segment it last asked for.
    private val readerPositions = ConcurrentHashMap<Long, Int>()

    /** Thrown to end a superseded reader's response instead of downloading for it. */
    class SupersededReaderException(message: String) : java.io.IOException(message)

    private class QueuedSample(
        val track: Int,
        val timestamp: Long,
        val flags: Int,
        val data: ByteArray
    )

    /** One extractor and the fragment it will produce next. */
    private class Cursor(val extractor: MediaExtractor, val descriptor: android.os.ParcelFileDescriptor?) {
        val lock = ReentrantLock()
        var nextIndex = -1 // -1: not positioned yet
        var nextStartUs = 0L
        var finished = false
        var lastUsedNs = System.nanoTime()
        val pendingSamples = java.util.ArrayDeque<QueuedSample>()
        // Background build-ahead continues this cursor up to this index, never seeking it.
        @Volatile var wantedThrough = -1
        @Volatile var prefetching = false
    }

    private val segmentDirectory = File(context.cacheDir, "cast-mp4-${UUID.randomUUID()}")
    val durationUs: Long
    val timelineOffsetUs: Long
    // Indexed mode: segment edges from the Cue index (first = timeline offset, last = duration).
    private val boundariesUs: LongArray?
    // Fixed byte budget per segment for the byte-range layout; null when unknown.
    private val segmentSlotBytes: LongArray?
    private var progressiveHeader: ByteArray? = null
    private var progressiveSegmentStarts: LongArray? = null
    private var videoTrack = -1
    private var audioTrack = -1
    @Volatile private var trackTimescales: Map<Int, Long>? = null
    @Volatile private var closed = false

    private val poolLock = Any()
    private val cursors = ArrayList<Cursor>()
    private var cursorsOpening = 0
    private val segmentLocks = ConcurrentHashMap<Int, ReentrantLock>()
    // Access-ordered: the eldest entry is the least recently used fragment.
    private val cachedSegments = LinkedHashMap<Int, Unit>(16, 0.75f, true)
    // Sequential mode: number of fragments once the end of the source is reached.
    @Volatile private var sequentialCount = -1

    init {
        val (extractor, descriptor) = openExtractor()
        val cursor = Cursor(extractor, descriptor)
        var handedToProducer = false
        try {
            val audio = audioTracks(extractor).getOrNull(audioOrdinal)
                ?: throw IllegalArgumentException("Audio track ${audioOrdinal + 1} is unavailable")
            val video = videoTracks(extractor).firstOrNull()
                ?: throw IllegalArgumentException("No video track found")
            val audioMime = extractor.getTrackFormat(audio).getString(MediaFormat.KEY_MIME)
            val videoMime = extractor.getTrackFormat(video).getString(MediaFormat.KEY_MIME)
            if (!FragmentedMp4Muxer.SUPPORTED_AUDIO_SAMPLE_MIME_TYPES.contains(audioMime)) {
                throw IllegalArgumentException("This audio track ($audioMime) needs transcoding, which is not supported yet")
            }
            if (!FragmentedMp4Muxer.SUPPORTED_VIDEO_SAMPLE_MIME_TYPES.contains(videoMime)) {
                throw IllegalArgumentException("This video codec ($videoMime) cannot be packaged as MP4")
            }
            val formatDurationUs = listOf(audio, video).maxOf { index ->
                val format = extractor.getTrackFormat(index)
                if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) else 0L
            }
            durationUs = if (formatDurationUs > 0) formatDurationUs else readDurationUs(descriptor)
            if (durationUs <= 0) throw IllegalArgumentException("Video duration is unavailable")
            val cues = try {
                MkvCueIndex.read(context, sourceUrl, isLocal, headers, durationUs)
            } catch (error: Exception) {
                Log.w(TAG, "Matroska Cue lookup unavailable", error)
                null
            }
            videoTrack = video
            audioTrack = audio
            extractor.selectTrack(video)
            extractor.selectTrack(audio)
            val requestedUs = (requestedStartSeconds.coerceAtLeast(0.0) * 1_000_000L).toLong()
                .coerceAtMost((durationUs - 1).coerceAtLeast(0))
            timelineOffsetUs = if (requestedUs > 0) {
                extractor.seekTo(requestedUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
                val keyframeUs = extractor.sampleTime
                require(keyframeUs in 0..requestedUs && requestedUs - keyframeUs <= MAX_SEGMENT_US) {
                    "This source cannot seek to the requested position without scanning earlier media"
                }
                keyframeUs
            } else {
                extractor.sampleTime.coerceAtLeast(0L)
            }
            val cueTimes = cues?.boundariesUs
            val cueStart = cueTimes?.indexOfLast { it <= timelineOffsetUs }?.coerceAtLeast(0) ?: 0
            boundariesUs = cueTimes?.copyOfRange(cueStart, cueTimes.size)
                ?.takeIf { it.size >= 2 && kotlin.math.abs(it[0] - timelineOffsetUs) <= 500_000L }
                ?.also { it[0] = timelineOffsetUs }
            segmentSlotBytes = if (boundariesUs != null && cueTimes != null) {
                cues?.sourceOffsets?.copyOfRange(cueStart, cueTimes.size)?.let { offsets ->
                    // Output keeps a subset of the source samples, but trun entries cost
                    // more than Matroska block headers; the margin covers that.
                    LongArray(offsets.size - 1) { i ->
                        val sourceBytes = offsets[i + 1] - offsets[i]
                        sourceBytes + sourceBytes / 32 + 64 * 1024
                    }
                }
            } else null
            cursor.nextIndex = 0
            cursor.nextStartUs = timelineOffsetUs
            segmentDirectory.mkdirs()
            Log.i(TAG, when {
                segmentSlotBytes != null -> "Byte-seekable MP4 with ${boundariesUs!!.size - 1} Cue segments"
                boundariesUs != null -> "Indexed MP4 with ${boundariesUs.size - 1} Cue segments; Cues lack byte positions"
                else -> "No usable Cue index; sequential MP4 from ${timelineOffsetUs / 1_000_000}s"
            })
            // Segment 0 also yields the MP4 header; one more gives the receiver a head start.
            while (!cursor.finished && cursor.nextIndex < INITIAL_SEGMENTS) produce(cursor)
            cursors.add(cursor)
            handedToProducer = true
        } finally {
            if (!handedToProducer) {
                extractor.release()
                descriptor?.close()
                segmentDirectory.deleteRecursively()
            }
        }
    }

    /** True when the whole file layout is known, so byte ranges can be served. */
    val supportsByteRanges: Boolean get() = segmentSlotBytes != null

    private val segmentCount: Int get() = boundariesUs?.size?.minus(1) ?: Int.MAX_VALUE

    @Synchronized private fun initSegment(): ByteArray = File(segmentDirectory, "init.mp4").readBytes()

    // ---- Byte-range layout -------------------------------------------------

    /**
     * ftyp+moov, a sidx indexing every segment, then one fixed-size slot per segment
     * (moof+mdat padded with a free box). Sizes are fixed up front, so any byte
     * range maps to one segment built on demand.
     */
    @Synchronized private fun progressiveLayout(): Pair<ByteArray, LongArray> {
        val header = progressiveHeader
        val starts = progressiveSegmentStarts
        if (header != null && starts != null) return header to starts
        val slots = segmentSlotBytes ?: throw IllegalStateException("Byte ranges need Cues with cluster positions")
        val boundaries = boundariesUs!!
        val init = initSegment()
        val videoTimescale = firstMdhdTimescale(init)
        val count = slots.size
        require(count <= 0xffff) { "Too many segments for one sidx" }
        // Version 1 layout: box header(8) version/flags(4) reference_ID(4) timescale(4)
        // earliest_presentation_time(8) first_offset(8) reserved(2) reference_count(2).
        val sidx = ByteArray(40 + 12 * count)
        putInt(sidx, 0, sidx.size)
        "sidx".toByteArray(Charsets.US_ASCII).copyInto(sidx, 4)
        sidx[8] = 1
        putInt(sidx, 12, 1) // reference_ID: video track
        putInt(sidx, 16, videoTimescale.toInt())
        sidx[38] = (count ushr 8).toByte()
        sidx[39] = count.toByte()
        for (i in 0 until count) {
            val entry = 40 + 12 * i
            require(slots[i] < 0x7fffffffL) { "Segment $i is too large for a sidx reference" }
            putInt(sidx, entry, slots[i].toInt())
            val duration = (boundaries[i + 1] - boundaries[i]) * videoTimescale / 1_000_000L
            putInt(sidx, entry + 4, duration.coerceIn(0L, 0xffffffffL).toInt())
            putInt(sidx, entry + 8, 0x90000000.toInt()) // starts_with_SAP=1, SAP type 1
        }
        val built = init + sidx
        val offsets = LongArray(count + 1)
        offsets[0] = built.size.toLong()
        for (i in 0 until count) offsets[i + 1] = offsets[i] + slots[i]
        progressiveHeader = built
        progressiveSegmentStarts = offsets
        return built to offsets
    }

    val progressiveLength: Long get() = progressiveLayout().second.last()

    /** Segment bytes padded with a free box to exactly the slot size. */
    private fun paddedSegment(index: Int, generation: Long): ByteArray {
        val slot = segmentSlotBytes!![index]
        val fragment = mediaSegment(index, generation)
            ?: throw IllegalStateException("Segment $index is past the end of the video")
        val padding = slot - fragment.size
        require(padding == 0L || padding >= 8) {
            "Segment $index is ${fragment.size} bytes, over its $slot byte slot"
        }
        if (padding == 0L) return fragment
        val out = fragment.copyOf(slot.toInt())
        putInt(out, fragment.size, padding.toInt())
        "free".toByteArray(Charsets.US_ASCII).copyInto(out, fragment.size + 4)
        return out
    }

    /**
     * Reads [start, endInclusive] of the byte-range file, building segments as reached.
     * Each call is a new reader; older readers far from it stop building (see [NEARBY_SEGMENTS]).
     */
    fun progressiveStream(start: Long, endInclusive: Long): InputStream {
        val (header, starts) = progressiveLayout()
        val generation = readerGeneration.incrementAndGet()
        return ChunkStream(onClose = { readerPositions.remove(generation) }) { position ->
            if (position > endInclusive) null
            else if (position < header.size) Chunk(0L, header, endInclusive)
            else {
                var index = java.util.Arrays.binarySearch(starts, position)
                if (index < 0) index = -index - 2
                Chunk(starts[index], paddedSegment(index, generation), endInclusive)
            }
        }.also { it.skipTo(start) }
    }

    // ---- Sequential stream (no byte ranges) --------------------------------

    /** Header then every segment in order, from this packager's start position. */
    fun sequentialStream(): InputStream {
        var nextIndex = -1
        var written = 0L
        return ChunkStream { position ->
            if (position != written) throw IllegalStateException("Sequential MP4 stream cannot seek")
            val bytes = if (nextIndex < 0) initSegment() else mediaSegment(nextIndex)
            if (bytes == null) null
            else {
                nextIndex++
                val chunk = Chunk(written, bytes, Long.MAX_VALUE)
                written += bytes.size
                chunk
            }
        }
    }

    private class Chunk(val start: Long, val bytes: ByteArray, val endInclusive: Long)

    /** InputStream over consecutive chunks resolved by absolute position. */
    private class ChunkStream(
        private val onClose: () -> Unit = {},
        private val resolve: (Long) -> Chunk?
    ) : InputStream() {
        private var position = 0L
        private var chunk: Chunk? = null

        override fun close() {
            onClose()
        }

        fun skipTo(target: Long) {
            position = target
        }

        override fun read(): Int {
            val one = ByteArray(1)
            return if (read(one, 0, 1) < 0) -1 else one[0].toInt() and 255
        }

        override fun read(target: ByteArray, offset: Int, length: Int): Int {
            if (length == 0) return 0
            var current = chunk
            if (current == null || position < current.start || position >= current.start + current.bytes.size) {
                current = resolve(position) ?: return -1
                chunk = current
            }
            if (position > current.endInclusive) return -1
            val within = (position - current.start).toInt()
            val count = minOf(
                length.toLong(),
                current.bytes.size - within.toLong(),
                current.endInclusive - position + 1
            ).toInt()
            current.bytes.copyInto(target, offset, within, within + count)
            position += count
            return count
        }
    }

    // ---- Segment access ----------------------------------------------------

    private fun segmentFile(index: Int) = File(segmentDirectory, "segment_$index.m4s")

    /**
     * Records where [generation] is reading. False when a newer reader is open and
     * this one is more than [NEARBY_SEGMENTS] away from it: a stale connection.
     */
    private fun isCurrentReader(generation: Long?, index: Int): Boolean {
        if (generation == null) return true
        readerPositions[generation] = index
        val newest = readerPositions.keys.maxOrNull() ?: return true
        if (generation == newest) return true
        val newestIndex = readerPositions[newest] ?: return true
        return kotlin.math.abs(index - newestIndex) <= NEARBY_SEGMENTS
    }

    /**
     * Fragment bytes for [index], or null past the end (sequential mode).
     * [generation] identifies the byte-range reader.
     */
    private fun mediaSegment(index: Int, generation: Long? = null): ByteArray? {
        if (boundariesUs != null) require(index in 0 until segmentCount) { "Segment $index does not exist" }
        // Evicted between the existence check and the read: build it again, once.
        for (attempt in 0..1) {
            if (sequentialCount in 0..index) return null
            readCached(index)?.let {
                followReader(index)
                return it
            }
            // Only a stale reader pays for building; cached segments stay free to serve.
            if (!isCurrentReader(generation, index)) {
                throw SupersededReaderException("Reader $generation at segment $index was superseded")
            }
            val segmentLock = segmentLocks.computeIfAbsent(index) { ReentrantLock() }
            segmentLock.lock()
            try {
                if (!segmentFile(index).exists()) {
                    if (boundariesUs == null) produceSequentialThrough(index) else produceIndexed(index)
                }
            } finally {
                segmentLock.unlock()
            }
        }
        if (sequentialCount in 0..index) return null
        return readCached(index)?.also { followReader(index) }
            ?: throw IllegalStateException("Segment $index could not be read")
    }

    private fun readCached(index: Int): ByteArray? {
        val bytes = try { segmentFile(index).readBytes() } catch (_: java.io.FileNotFoundException) { return null }
        synchronized(cachedSegments) { cachedSegments[index] } // refresh LRU position
        return bytes
    }

    /** Records a built fragment and deletes the least recently used ones beyond the cap. */
    private fun remember(index: Int) {
        val evicted = ArrayList<Int>()
        synchronized(cachedSegments) {
            cachedSegments[index] = Unit
            val iterator = cachedSegments.keys.iterator()
            while (cachedSegments.size - evicted.size > MAX_CACHED_SEGMENTS && iterator.hasNext()) {
                val eldest = iterator.next()
                if (eldest == index) continue
                evicted.add(eldest)
            }
            evicted.forEach { cachedSegments.remove(it) }
        }
        evicted.forEach { segmentFile(it).delete() }
    }

    /** Keeps the cursor already following this reader building ahead of it. */
    private fun followReader(index: Int) {
        val follower = synchronized(poolLock) {
            cursors.firstOrNull { it.nextIndex in (index + 1)..(index + AHEAD_SEGMENTS + 1) }
        } ?: return
        if (follower.wantedThrough < index + AHEAD_SEGMENTS) follower.wantedThrough = index + AHEAD_SEGMENTS
        startPrefetch(follower)
    }

    // ---- Production ----------------------------------------------------------

    /** Indexed mode: build [index] with a cursor already there, or reposition one. */
    private fun produceIndexed(index: Int) {
        val cursor = acquireCursor(index)
        try {
            if (cursor.nextIndex != index) seekToCue(cursor, index)
            produce(cursor)
            if (cursor.wantedThrough < index + AHEAD_SEGMENTS) cursor.wantedThrough = index + AHEAD_SEGMENTS
        } finally {
            cursor.lastUsedNs = System.nanoTime()
            cursor.lock.unlock()
        }
        startPrefetch(cursor)
    }

    /** Sequential mode: one cursor moving forward; an evicted earlier segment restarts it. */
    private fun produceSequentialThrough(index: Int) {
        val cursor = synchronized(poolLock) { cursors.first() }
        cursor.lock.lock()
        try {
            if (index < cursor.nextIndex) restartSequential(cursor)
            while (cursor.nextIndex <= index && !cursor.finished) produce(cursor)
            if (cursor.finished && sequentialCount < 0) sequentialCount = cursor.nextIndex
            if (cursor.wantedThrough < index + AHEAD_SEGMENTS) cursor.wantedThrough = index + AHEAD_SEGMENTS
        } finally {
            cursor.lastUsedNs = System.nanoTime()
            cursor.lock.unlock()
        }
        startPrefetch(cursor)
    }

    /**
     * Returns a locked cursor for [index]: one already positioned there, else a new
     * one while under [MAX_CURSORS], else the least recently used idle one.
     */
    private fun acquireCursor(index: Int): Cursor {
        var openNew = false
        synchronized(poolLock) {
            cursors.firstOrNull { it.nextIndex == index && it.lock.tryLock() }?.let { return it }
            if (cursors.size + cursorsOpening < MAX_CURSORS) {
                cursorsOpening++
                openNew = true
            } else {
                cursors.sortedBy { it.lastUsedNs }.firstOrNull { it.lock.tryLock() }?.let { return it }
            }
        }
        if (openNew) {
            val cursor = try {
                val (extractor, descriptor) = openExtractor()
                extractor.selectTrack(videoTrack)
                extractor.selectTrack(audioTrack)
                Cursor(extractor, descriptor)
            } finally {
                synchronized(poolLock) { cursorsOpening-- }
            }
            cursor.lock.lock()
            synchronized(poolLock) { cursors.add(cursor) }
            if (closed) {
                cursor.lock.unlock()
                throw IllegalStateException("Packaging session closed")
            }
            return cursor
        }
        // Every cursor is busy: wait for the least recently used one.
        val oldest = synchronized(poolLock) { cursors.minByOrNull { it.lastUsedNs }!! }
        oldest.lock.lock()
        return oldest
    }

    /**
     * Builds ahead on [cursor] from where it is, up to its [Cursor.wantedThrough].
     * It never seeks and gives up whenever the cursor or segment is taken, so it
     * cannot pull an extractor away from a reader.
     */
    private fun startPrefetch(cursor: Cursor) {
        if (cursor.prefetching || closed) return
        cursor.prefetching = true
        Thread {
            try {
                while (!closed) {
                    if (!cursor.lock.tryLock()) break
                    try {
                        val index = cursor.nextIndex
                        if (cursor.finished || index < 0 || index > cursor.wantedThrough || index >= segmentCount) break
                        if (segmentFile(index).exists()) break
                        val segmentLock = segmentLocks.computeIfAbsent(index) { ReentrantLock() }
                        if (!segmentLock.tryLock()) break
                        try {
                            if (!segmentFile(index).exists()) produce(cursor)
                        } finally {
                            segmentLock.unlock()
                        }
                        if (boundariesUs == null && cursor.finished && sequentialCount < 0) {
                            sequentialCount = cursor.nextIndex
                        }
                    } finally {
                        cursor.lock.unlock()
                    }
                }
            } catch (error: Exception) {
                Log.w(TAG, "Build-ahead stopped: ${error.message}")
            } finally {
                cursor.prefetching = false
            }
        }.start()
    }

    private fun seekToCue(cursor: Cursor, index: Int) {
        val cueUs = boundariesUs!![index]
        cursor.pendingSamples.clear()
        cursor.extractor.seekTo(cueUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
        cursor.nextIndex = index
        cursor.nextStartUs = cueUs
        cursor.finished = false
    }

    private fun restartSequential(cursor: Cursor) {
        Log.i(TAG, "Restarting sequential packaging from ${timelineOffsetUs / 1_000_000}s")
        cursor.pendingSamples.clear()
        cursor.extractor.seekTo(timelineOffsetUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
        cursor.nextIndex = 0
        cursor.nextStartUs = timelineOffsetUs
        cursor.finished = false
    }

    fun clear() {
        if (closed) return
        closed = true
        // Network reads must never block the React Native module queue or HTTP readers.
        Thread {
            val all = synchronized(poolLock) { cursors.toList().also { cursors.clear() } }
            for (cursor in all) {
                cursor.lock.lock()
                try {
                    cursor.extractor.release()
                    cursor.descriptor?.close()
                } finally {
                    cursor.lock.unlock()
                }
            }
            segmentDirectory.deleteRecursively()
        }.start()
    }

    /** Builds the fragment at [Cursor.nextIndex] and advances the cursor. Caller holds its lock. */
    private fun produce(cursor: Cursor) {
        val extractor = cursor.extractor
        val boundaries = boundariesUs
        val index = cursor.nextIndex
        val startUs = cursor.nextStartUs
        var endUs = boundaries?.getOrNull(index + 1) ?: durationUs
        var reachedEnd = false
        val output = ByteArrayOutputStream()
        val muxer = FragmentedMp4Muxer.Builder(output)
            .setFragmentDurationMs(60_000)
            .build()
        var firstVideoUs = -1L
        var firstAudioUs = -1L
        var lastAudioUs = -1L
        var audioSamples = 0
        try {
            val videoId = muxer.addTrack(toMedia3Format(extractor.getTrackFormat(videoTrack)))
            val audioId = if (audioTrack >= 0) muxer.addTrack(toMedia3Format(extractor.getTrackFormat(audioTrack))) else -1

            var videoReachedEnd = false
            var audioReachedEnd = (audioTrack < 0)

            // 1. Drain pending samples buffered from previous read-ahead
            while (cursor.pendingSamples.isNotEmpty()) {
                val peek = cursor.pendingSamples.peekFirst() ?: break
                if (boundaries != null) {
                    if (peek.track == videoTrack && peek.timestamp >= endUs) videoReachedEnd = true
                    if (peek.track == audioTrack && peek.timestamp >= endUs) audioReachedEnd = true
                }
                if (peek.timestamp >= endUs && (videoReachedEnd && audioReachedEnd)) {
                    break
                }
                if (peek.timestamp >= endUs) {
                    break
                }
                val sample = cursor.pendingSamples.removeFirst()
                if (sample.timestamp >= startUs && (sample.track == videoTrack || sample.track == audioTrack)) {
                    if (sample.track == videoTrack && firstVideoUs < 0) firstVideoUs = sample.timestamp
                    if (sample.track == audioTrack) {
                        if (firstAudioUs < 0) firstAudioUs = sample.timestamp
                        lastAudioUs = sample.timestamp
                        audioSamples++
                    }
                    muxer.writeSampleData(
                        if (sample.track == videoTrack) videoId else audioId,
                        ByteBuffer.wrap(sample.data),
                        BufferInfo(sample.timestamp - timelineOffsetUs, sample.data.size, sample.flags)
                    )
                }
            }

            val buffer = ByteBuffer.allocateDirect(8 * 1024 * 1024)
            while (!videoReachedEnd || !audioReachedEnd) {
                buffer.clear()
                val size = extractor.readSampleData(buffer, 0)
                if (size < 0) { reachedEnd = true; break }
                val timestamp = extractor.sampleTime
                val track = extractor.sampleTrackIndex
                val flags = if (extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0)
                    C.BUFFER_FLAG_KEY_FRAME else 0

                if (boundaries != null) {
                    if (track == videoTrack && timestamp >= endUs) videoReachedEnd = true
                    if (track == audioTrack && timestamp >= endUs) audioReachedEnd = true
                }

                if (timestamp > startUs + MAX_SEGMENT_US) {
                    throw IllegalStateException("No video keyframe within ${MAX_SEGMENT_US / 1_000_000} seconds at ${startUs / 1_000_000}s")
                }
                if (boundaries == null && track == videoTrack && timestamp >= startUs + SEQUENTIAL_SEGMENT_US &&
                    extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) {
                    endUs = timestamp
                    videoReachedEnd = true
                    audioReachedEnd = true
                    val sampleBytes = ByteArray(size)
                    buffer.position(0)
                    buffer.get(sampleBytes)
                    cursor.pendingSamples.addLast(QueuedSample(track, timestamp, flags, sampleBytes))
                    extractor.advance()
                    break
                }

                if (boundaries == null || timestamp < endUs) {
                    if (timestamp >= startUs && (track == videoTrack || track == audioTrack)) {
                        if (track == videoTrack && firstVideoUs < 0) firstVideoUs = timestamp
                        if (track == audioTrack) {
                            if (firstAudioUs < 0) firstAudioUs = timestamp
                            lastAudioUs = timestamp
                            audioSamples++
                        }
                        buffer.position(0)
                        buffer.limit(size)
                        muxer.writeSampleData(
                            if (track == videoTrack) videoId else audioId,
                            buffer,
                            BufferInfo(timestamp - timelineOffsetUs, size, flags)
                        )
                    }
                } else if (track == videoTrack || track == audioTrack) {
                    val sampleBytes = ByteArray(size)
                    buffer.position(0)
                    buffer.get(sampleBytes)
                    cursor.pendingSamples.addLast(QueuedSample(track, timestamp, flags, sampleBytes))
                }

                if (cursor.pendingSamples.size > 200 || timestamp > endUs + 3_000_000L) {
                    break
                }

                if (!extractor.advance()) { reachedEnd = true; break }
            }
        } finally {
            try {
                muxer.close()
            } catch (error: Exception) {
                // An empty trailing segment in sequential mode has nothing to close.
                if (firstVideoUs >= 0 || firstAudioUs >= 0) throw error
            }
        }
        if (boundaries != null && reachedEnd && index + 1 < boundaries.size - 1) {
            throw IllegalStateException("Source ended before indexed segment $index")
        }
        if (boundaries == null && reachedEnd && firstVideoUs < 0) {
            // Nothing left after the previous keyframe split.
            cursor.finished = true
            return
        }
        val bytes = output.toByteArray()
        require(endUs > startUs && endUs - startUs <= MAX_SEGMENT_US) {
            "Source ended before the advertised duration; refusing an invalid segment"
        }
        val fragmentOffset = findTopLevelBox(bytes, "moof")
        Log.d(TAG, "Segment $index start=$startUs end=$endUs video=$firstVideoUs audio=$firstAudioUs bytes=${bytes.size}")
        if (fragmentOffset <= 0) throw IllegalStateException("MP4 fragment was not produced")
        if (index == 0) synchronized(this) {
            if (!File(segmentDirectory, "init.mp4").exists()) {
                val init = bytes.copyOfRange(0, fragmentOffset)
                val ftypOffset = findTopLevelBox(init, "ftyp")
                require(ftypOffset >= 0 && readInt(init, ftypOffset) >= 24) { "Missing MP4 file type" }
                "iso6".toByteArray(Charsets.US_ASCII).copyInto(init, ftypOffset + 8)
                "iso6".toByteArray(Charsets.US_ASCII).copyInto(init, ftypOffset + 20)
                patchInitDurations(init)
                File(segmentDirectory, "init.mp4").writeBytes(init)
                trackTimescales = parseTrackTimescales(init)
            }
        }
        val scales = getTimescales()
        val videoScale = scales[1] ?: 90_000L
        val audioScale = scales[2] ?: 48_000L
        val segmentStartUs = boundaries?.getOrNull(index) ?: startUs
        val baseTimeUs = (segmentStartUs - timelineOffsetUs).coerceAtLeast(0L)
        // Audio starts at its own first sample: anchoring it to the video segment start
        // would shift it by the gap between the keyframe and the first audio frame.
        val audioBaseUs = if (firstAudioUs >= 0) (firstAudioUs - timelineOffsetUs).coerceAtLeast(0L) else baseTimeUs
        // Matroska timestamps are rounded to 1 ms, so per-sample audio durations derived
        // from them are wrong (AAC at 48 kHz came out ~1002 ticks instead of 1024,
        // leaving an ~80 ms hole per fragment). The mean spacing over the fragment is exact.
        // AAC frames have a fixed length (1024 samples; HE-AAC 2048 at the output rate), so
        // use it exactly. Laced Matroska audio gets interpolated timestamps that run short,
        // which left a ~65 ms hole per fragment and stalled audio-clocked players.
        val audioFormat = extractor.getTrackFormat(audioTrack)
        val audioFrameTicks = aacFrameTicks(audioFormat, audioScale)
            ?: if (audioSamples >= 2)
                (lastAudioUs - firstAudioUs).toDouble() / (audioSamples - 1) * audioScale / 1_000_000.0
            else null
        val trackStarts = mutableMapOf<Int, Pair<Long, Long>>()
        trackStarts[1] = Pair(baseTimeUs, videoScale)
        if (firstAudioUs >= 0) {
            trackStarts[2] = Pair(audioBaseUs, audioScale)
        }
        val fragment = interleave(
            makeStandaloneFragment(
                bytes.copyOfRange(fragmentOffset, bytes.size),
                trackStarts,
                index + 1
            ),
            scales,
            if (audioFrameTicks != null && audioSamples > 0) mapOf(2 to audioFrameTicks) else emptyMap()
        )
        val temporary = File(segmentDirectory, "segment_$index.m4s.part")
        temporary.writeBytes(fragment)
        require(temporary.renameTo(segmentFile(index))) {
            "Cannot publish segment $index"
        }
        remember(index)
        cursor.nextStartUs = endUs
        cursor.nextIndex = index + 1
        cursor.finished = reachedEnd || (boundaries != null && cursor.nextIndex >= boundaries.size - 1)
    }

    // ---- MP4 box helpers ---------------------------------------------------

    private fun readInt(data: ByteArray, offset: Int): Int =
        ((data[offset].toInt() and 255) shl 24) or
            ((data[offset + 1].toInt() and 255) shl 16) or
            ((data[offset + 2].toInt() and 255) shl 8) or
            (data[offset + 3].toInt() and 255)

    private fun putInt(data: ByteArray, offset: Int, value: Int) {
        for (i in 0..3) data[offset + i] = (value ushr (24 - 8 * i)).toByte()
    }

    /** AAC frame duration in [timescale] ticks, or null for other codecs. */
    private fun aacFrameTicks(format: MediaFormat, timescale: Long): Double? {
        if (format.getString(MediaFormat.KEY_MIME) != "audio/mp4a-latm") return null
        if (!format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) return null
        val sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        if (sampleRate <= 0) return null
        // AudioSpecificConfig object type 5 (SBR) / 29 (PS): 2048 output samples per frame.
        val objectType = format.getByteBuffer("csd-0")?.duplicate()?.let { csd ->
            if (csd.remaining() >= 1) (csd.get(csd.position()).toInt() and 0xff) ushr 3 else null
        }
        // Extractors report either the SBR output rate or the core rate; above 24 kHz it is
        // the output rate, where one frame spans 2048 samples.
        val samplesPerFrame = if ((objectType == 5 || objectType == 29) && sampleRate > 24_000) 2048 else 1024
        return samplesPerFrame.toDouble() * timescale / sampleRate
    }

    private fun parseTrackTimescales(init: ByteArray): Map<Int, Long> {
        val result = mutableMapOf<Int, Long>()
        var offset = 0
        while (offset < init.size - 8) {
            val size = readInt(init, offset)
            if (size < 8 || offset + size > init.size) break
            val type = String(init, offset + 4, 4, Charsets.US_ASCII)
            if (type == "moov") {
                var moovOffset = offset + 8
                val moovEnd = offset + size
                while (moovOffset < moovEnd - 8) {
                    val boxSize = readInt(init, moovOffset)
                    if (boxSize < 8 || moovOffset + boxSize > moovEnd) break
                    val boxType = String(init, moovOffset + 4, 4, Charsets.US_ASCII)
                    if (boxType == "trak") {
                        var trakOffset = moovOffset + 8
                        val trakEnd = moovOffset + boxSize
                        var trackId = -1
                        var timescale = -1L
                        while (trakOffset < trakEnd - 8) {
                            val childSize = readInt(init, trakOffset)
                            if (childSize < 8 || trakOffset + childSize > trakEnd) break
                            val childType = String(init, trakOffset + 4, 4, Charsets.US_ASCII)
                            if (childType == "tkhd") {
                                val version = init[trakOffset + 8].toInt() and 255
                                trackId = if (version == 0) readInt(init, trakOffset + 20) else readInt(init, trakOffset + 28)
                            } else if (childType == "mdia") {
                                var mdiaOffset = trakOffset + 8
                                val mdiaEnd = trakOffset + childSize
                                while (mdiaOffset < mdiaEnd - 8) {
                                    val grandSize = readInt(init, mdiaOffset)
                                    if (grandSize < 8 || mdiaOffset + grandSize > mdiaEnd) break
                                    if (String(init, mdiaOffset + 4, 4, Charsets.US_ASCII) == "mdhd") {
                                        val version = init[mdiaOffset + 8].toInt() and 255
                                        timescale = if (version == 0) readInt(init, mdiaOffset + 20).toLong() and 0xffffffffL
                                            else readInt(init, mdiaOffset + 28).toLong() and 0xffffffffL
                                    }
                                    mdiaOffset += grandSize
                                }
                            }
                            trakOffset += childSize
                        }
                        if (trackId > 0 && timescale > 0L) {
                            result[trackId] = timescale
                        }
                    }
                    moovOffset += boxSize
                }
            }
            offset += size
        }
        return result
    }

    private fun getTimescales(): Map<Int, Long> {
        trackTimescales?.let { return it }
        val init = try { initSegment() } catch (_: Exception) { null }
        val parsed = if (init != null) parseTrackTimescales(init) else emptyMap()
        val scales = mapOf(
            1 to (parsed[1] ?: 90_000L),
            2 to (parsed[2] ?: 48_000L)
        )
        if (init != null) trackTimescales = scales
        return scales
    }

    private fun firstMdhdTimescale(init: ByteArray): Long =
        getTimescales()[1] ?: 90_000L

    private fun patchInitDurations(init: ByteArray) {
        val remainingUs = (durationUs - timelineOffsetUs).coerceAtLeast(1L)
        // Walks the box tree so codec data inside stsd can never be mistaken for a box.
        val moov = childBoxes(init, 0, init.size).firstOrNull { it.type == "moov" } ?: return
        val moovChildren = childBoxes(init, moov.bodyStart, moov.end)
        // Millisecond movie timescale: some players misread Media3's 10000 (Reflector
        // reported a 10x duration). tkhd and mehd durations use the same scale.
        val movieScale = 1000L
        val movieDuration = remainingUs * movieScale / 1_000_000L
        moovChildren.firstOrNull { it.type == "mvhd" }?.let { box ->
            // Full box: version byte, flags, then v0 32-bit or v1 64-bit times.
            val v1 = init[box.bodyStart] == 1.toByte()
            val times = box.bodyStart + 4
            val scaleOffset = times + if (v1) 16 else 8
            putInt(init, scaleOffset, movieScale.toInt())
            putDuration(init, scaleOffset + 4, v1, movieDuration)
        }
        for (box in moovChildren) when (box.type) {
            "mvex" -> childBoxes(init, box.bodyStart, box.end).filter { it.type == "mehd" }.forEach { mehd ->
                putDuration(init, mehd.bodyStart + 4, init[mehd.bodyStart] == 1.toByte(), movieDuration)
            }
            "trak" -> for (trakChild in childBoxes(init, box.bodyStart, box.end)) when (trakChild.type) {
                "tkhd" -> {
                    val v1 = init[trakChild.bodyStart] == 1.toByte()
                    // creation, modification, track_ID, reserved, then duration.
                    val offset = trakChild.bodyStart + 4 + if (v1) 24 else 16
                    putDuration(init, offset, v1, movieDuration)
                }
                "mdia" -> childBoxes(init, trakChild.bodyStart, trakChild.end)
                    .firstOrNull { it.type == "mdhd" }?.let { mdhd ->
                        val v1 = init[mdhd.bodyStart] == 1.toByte()
                        val scaleOffset = mdhd.bodyStart + 4 + if (v1) 16 else 8
                        val scale = readInt(init, scaleOffset).toLong().coerceAtLeast(1L)
                        putDuration(init, scaleOffset + 4, v1, remainingUs * scale / 1_000_000L)
                    }
            }
        }
    }

    private class Box(val type: String, val bodyStart: Int, val end: Int)

    /** Direct children of the box body [start, end); stops at a malformed size. */
    private fun childBoxes(data: ByteArray, start: Int, end: Int): List<Box> {
        val boxes = ArrayList<Box>()
        var offset = start
        while (offset + 8 <= end) {
            var size = readInt(data, offset).toLong() and 0xffffffffL
            var header = 8
            if (size == 1L) {
                if (offset + 16 > end) break
                size = (readInt(data, offset + 8).toLong() shl 32) or (readInt(data, offset + 12).toLong() and 0xffffffffL)
                header = 16
            } else if (size == 0L) {
                size = (end - offset).toLong()
            }
            if (size < header || offset + size > end) break
            val type = String(data, offset + 4, 4, Charsets.US_ASCII)
            boxes += Box(type, offset + header, (offset + size).toInt())
            offset += size.toInt()
        }
        return boxes
    }

    private fun putDuration(data: ByteArray, offset: Int, v1: Boolean, value: Long) {
        if (v1) {
            putInt(data, offset, (value ushr 32).toInt())
            putInt(data, offset + 4, value.toInt())
        } else {
            putInt(data, offset, value.coerceAtMost(0xffffffffL).toInt())
        }
    }

    /**
     * Rewrites Media3's fragment so it stands alone: moof-relative data offsets
     * (default-base-is-moof), a tfdt per track, and an increasing sequence number.
     */
    private fun makeStandaloneFragment(fragment: ByteArray, starts: Map<Int, Pair<Long, Long>>, sequence: Int): ByteArray {
        val moofSize = readInt(fragment, 0)
        if (String(fragment, 4, 4, Charsets.US_ASCII) != "moof" || moofSize > fragment.size) {
            throw IllegalStateException("Invalid MP4 fragment")
        }
        val out = ByteArrayOutputStream()
        out.write(fragment, 0, 8)
        var child = 8
        while (child < moofSize) {
            val size = readInt(fragment, child)
            val type = String(fragment, child + 4, 4, Charsets.US_ASCII)
            if (size < 8 || child + size > moofSize) throw IllegalStateException("Invalid MP4 box")
            if (type == "mfhd") {
                val mfhd = fragment.copyOfRange(child, child + size)
                putInt(mfhd, 12, sequence)
                out.write(mfhd)
            } else if (type != "traf") {
                out.write(fragment, child, size)
            } else {
                val trafStart = out.size()
                out.write(fragment, child, 8)
                var nested = child + 8
                while (nested < child + size) {
                    val nestedSize = readInt(fragment, nested)
                    val nestedType = String(fragment, nested + 4, 4, Charsets.US_ASCII)
                    if (nestedSize < 8 || nested + nestedSize > child + size) throw IllegalStateException("Invalid MP4 track box")
                    if (nestedType == "tfhd") {
                        val original = fragment.copyOfRange(nested, nested + nestedSize)
                        val flags = readInt(original, 8) and 0x00ffffff
                        if (flags and 1 == 0) throw IllegalStateException("MP4 track has no base offset")
                        val trackId = readInt(original, 12)
                        val (trackFirstUs, scale) = starts[trackId]
                            ?: throw IllegalStateException("Unknown MP4 track")
                        val firstUs = if (trackFirstUs >= 0) trackFirstUs else 0L
                        // Drop the absolute base_data_offset; the fragment is addressed from
                        // its own moof, wherever it lands in the file.
                        val tfhd = original.copyOfRange(0, 16) + original.copyOfRange(24, original.size)
                        putInt(tfhd, 0, tfhd.size)
                        putInt(tfhd, 8, (readInt(original, 8) and 1.inv()) or 0x020000)
                        out.write(tfhd)
                        val tfdt = ByteArray(20)
                        putInt(tfdt, 0, 20)
                        "tfdt".toByteArray(Charsets.US_ASCII).copyInto(tfdt, 4)
                        tfdt[8] = 1
                        val base = firstUs * scale / 1_000_000L
                        for (i in 0..7) tfdt[12 + i] = (base ushr (56 - 8 * i)).toByte()
                        out.write(tfdt)
                    } else if (nestedType != "tfdt") {
                        out.write(fragment, nested, nestedSize)
                    }
                    nested += nestedSize
                }
                val current = out.toByteArray()
                putInt(current, trafStart, out.size() - trafStart)
                out.reset()
                out.write(current)
            }
            child += size
        }
        val patchedMoof = out.toByteArray()
        val delta = patchedMoof.size - moofSize
        putInt(patchedMoof, 0, patchedMoof.size)
        var offset = 8
        while (offset < patchedMoof.size) {
            val size = readInt(patchedMoof, offset)
            if (String(patchedMoof, offset + 4, 4, Charsets.US_ASCII) == "traf") {
                var nested = offset + 8
                while (nested < offset + size) {
                    val nestedSize = readInt(patchedMoof, nested)
                    if (String(patchedMoof, nested + 4, 4, Charsets.US_ASCII) == "trun") {
                        val flags = readInt(patchedMoof, nested + 8) and 0x00ffffff
                        if (flags and 1 != 0) putInt(patchedMoof, nested + 16, readInt(patchedMoof, nested + 16) + delta)
                    }
                    nested += nestedSize
                }
            }
            offset += size
        }
        return patchedMoof + fragment.copyOfRange(moofSize, fragment.size)
    }

    private class RunSample(val entry: ByteArray, val dataPosition: Int, val size: Int, val timeSeconds: Double)

    private class TrackFragment(
        val tfhd: ByteArray,
        val tfdt: ByteArray,
        val version: Int,
        val flags: Int,
        val firstSampleFlags: Int?,
        val samples: List<RunSample>
    )

    /**
     * Media3 writes a fragment as all video samples, then all audio samples. A
     * progressive player (Chrome and Cast use FFmpeg's demuxer) reads samples in time
     * order, so it jumps from the video data to the audio data and back inside every
     * fragment, and each jump past its loaded range is a new HTTP request. Playback
     * then stalls on round trips.
     *
     * This splits each track's single trun into one trun per [INTERLEAVE_SECONDS] and
     * lays the mdat out as video chunk 0, audio chunk 0, video chunk 1, ... so the
     * file reads front to back. Returns the input unchanged if its shape is unexpected.
     */
    private fun interleave(
        fragment: ByteArray,
        timescales: Map<Int, Long>,
        // Track id -> exact per-sample duration in track ticks, replacing the muxer's.
        sampleDurations: Map<Int, Double> = emptyMap()
    ): ByteArray {
        val moofSize = readInt(fragment, 0)
        if (moofSize + 8 > fragment.size || String(fragment, moofSize + 4, 4, Charsets.US_ASCII) != "mdat") return fragment
        var mfhd: ByteArray? = null
        val tracks = ArrayList<TrackFragment>()
        var child = 8
        while (child < moofSize) {
            val size = readInt(fragment, child)
            when (String(fragment, child + 4, 4, Charsets.US_ASCII)) {
                "mfhd" -> mfhd = fragment.copyOfRange(child, child + size)
                "traf" -> {
                    var tfhd: ByteArray? = null
                    var tfdt: ByteArray? = null
                    var trun = -1
                    var truns = 0
                    var nested = child + 8
                    while (nested < child + size) {
                        val nestedSize = readInt(fragment, nested)
                        when (String(fragment, nested + 4, 4, Charsets.US_ASCII)) {
                            "tfhd" -> tfhd = fragment.copyOfRange(nested, nested + nestedSize)
                            "tfdt" -> tfdt = fragment.copyOfRange(nested, nested + nestedSize)
                            "trun" -> { trun = nested; truns++ }
                            else -> {
                                // Ignore auxiliary boxes (e.g. sdtp)
                            }
                        }
                        nested += nestedSize
                    }
                    if (tfhd == null || tfdt == null || truns != 1 || tfdt[8] != 1.toByte()) return fragment
                    val scale = timescales[readInt(tfhd, 12)] ?: return fragment
                    val version = fragment[trun + 8].toInt() and 255
                    val flags = readInt(fragment, trun + 8) and 0x00ffffff
                    // Needs data_offset plus per-sample duration and size
                    if (flags and 0x1 == 0 || flags and 0x100 == 0 || flags and 0x200 == 0) return fragment
                    val hasFirstSampleFlags = (flags and 0x4) != 0
                    val count = readInt(fragment, trun + 12)
                    val entrySize = 4 * Integer.bitCount(flags and 0xf00)
                    var position = readInt(fragment, trun + 16)
                    val firstSampleFlags = if (hasFirstSampleFlags) readInt(fragment, trun + 20) else null
                    var decodeTime = 0L
                    for (i in 0..7) decodeTime = (decodeTime shl 8) or (tfdt[12 + i].toLong() and 255)
                    var entry = if (hasFirstSampleFlags) trun + 24 else trun + 20
                    val samples = ArrayList<RunSample>(count)
                    val fixedDuration = sampleDurations[readInt(tfhd, 12)]
                    repeat(count) { k ->
                        val bytes = fragment.copyOfRange(entry, entry + entrySize)
                        if (fixedDuration != null) {
                            // Cumulative rounding keeps the total equal to count * fixedDuration.
                            val exact = Math.round((k + 1) * fixedDuration) - Math.round(k * fixedDuration)
                            putInt(bytes, 0, exact.toInt())
                        }
                        val duration = readInt(bytes, 0).toLong() and 0xffffffffL
                        val sampleSize = readInt(bytes, 4)
                        samples.add(RunSample(bytes, position, sampleSize, decodeTime.toDouble() / scale))
                        position += sampleSize
                        decodeTime += duration
                        entry += entrySize
                    }
                    if (samples.isEmpty() || position > fragment.size) return fragment
                    tracks.add(TrackFragment(tfhd, tfdt, version, flags, firstSampleFlags, samples))
                }
                else -> if (String(fragment, child + 4, 4, Charsets.US_ASCII) != "mfhd") return fragment
            }
            child += size
        }
        if (mfhd == null || tracks.isEmpty()) return fragment

        val start = tracks.minOf { it.samples.first().timeSeconds }
        val chunkSeconds = INTERLEAVE_SECONDS
        fun chunkOf(sample: RunSample) = ((sample.timeSeconds - start) / chunkSeconds).toInt().coerceAtLeast(0)
        val chunkCount = tracks.maxOf { track -> chunkOf(track.samples.last()) } + 1
        // groups[track][chunk]: samples of that track decoded within that chunk.
        val groups = tracks.map { track ->
            val byChunk = Array(chunkCount) { ArrayList<RunSample>() }
            track.samples.forEach { byChunk[chunkOf(it)].add(it) }
            byChunk
        }
        val newMoofSize = 8 + mfhd.size + tracks.indices.sumOf { t ->
            val track = tracks[t]
            val runs = groups[t].filter { it.isNotEmpty() }
            8 + track.tfhd.size + track.tfdt.size +
                runs.mapIndexed { idx, it ->
                    val trunOverhead = if (idx == 0 && track.firstSampleFlags != null) 24 else 20
                    trunOverhead + it.size * it.first().entry.size
                }.sum()
        }

        val body = ByteArrayOutputStream()
        val groupStart = Array(tracks.size) { IntArray(chunkCount) }
        for (chunk in 0 until chunkCount) {
            for (t in tracks.indices) {
                groupStart[t][chunk] = body.size()
                groups[t][chunk].forEach { body.write(fragment, it.dataPosition, it.size) }
            }
        }
        val moof = ByteArrayOutputStream()
        fun writeInt(value: Int) {
            moof.write(value ushr 24); moof.write(value ushr 16); moof.write(value ushr 8); moof.write(value)
        }
        writeInt(newMoofSize)
        moof.write("moof".toByteArray(Charsets.US_ASCII))
        moof.write(mfhd)
        for (t in tracks.indices) {
            val track = tracks[t]
            val runs = (0 until chunkCount).filter { groups[t][it].isNotEmpty() }
            val trafContentSize = track.tfhd.size + track.tfdt.size + runs.mapIndexed { idx, chunk ->
                val trunOverhead = if (idx == 0 && track.firstSampleFlags != null) 24 else 20
                trunOverhead + groups[t][chunk].size * track.samples.first().entry.size
            }.sum()
            writeInt(8 + trafContentSize)
            moof.write("traf".toByteArray(Charsets.US_ASCII))
            moof.write(track.tfhd)
            moof.write(track.tfdt)
            for ((runIdx, chunk) in runs.withIndex()) {
                val samples = groups[t][chunk]
                val hasFirstFlags = (runIdx == 0 && track.firstSampleFlags != null)
                val trunOverhead = if (hasFirstFlags) 24 else 20
                writeInt(trunOverhead + samples.size * samples.first().entry.size)
                moof.write("trun".toByteArray(Charsets.US_ASCII))
                val runFlags = if (hasFirstFlags) track.flags else (track.flags and 0x4.inv())
                writeInt((track.version shl 24) or (runFlags and 0x00ffffff))
                writeInt(samples.size)
                // default-base-is-moof: offset from the moof start to this group's data.
                writeInt(newMoofSize + 8 + groupStart[t][chunk])
                if (hasFirstFlags) {
                    writeInt(track.firstSampleFlags!!)
                }
                samples.forEach { moof.write(it.entry) }
            }
        }
        val moofBytes = moof.toByteArray()
        check(moofBytes.size == newMoofSize) { "Interleaved moof size mismatch: ${moofBytes.size} vs $newMoofSize" }
        val mdatHeader = ByteArray(8)
        putInt(mdatHeader, 0, 8 + body.size())
        "mdat".toByteArray(Charsets.US_ASCII).copyInto(mdatHeader, 4)
        return moofBytes + mdatHeader + body.toByteArray()
    }

    private fun findTopLevelBox(bytes: ByteArray, type: String): Int {
        var offset = 0
        while (offset + 8 <= bytes.size) {
            val size = readInt(bytes, offset)
            val boxType = String(bytes, offset + 4, 4, Charsets.US_ASCII)
            if (boxType == type) return offset
            if (size < 8 || offset + size > bytes.size) break
            offset += size
        }
        return -1
    }

    private fun toMedia3Format(format: MediaFormat): Format {
        val builder = Format.Builder().setSampleMimeType(format.getString(MediaFormat.KEY_MIME))
        if (format.containsKey(MediaFormat.KEY_WIDTH)) builder.setWidth(format.getInteger(MediaFormat.KEY_WIDTH))
        if (format.containsKey(MediaFormat.KEY_HEIGHT)) builder.setHeight(format.getInteger(MediaFormat.KEY_HEIGHT))
        if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) builder.setChannelCount(format.getInteger(MediaFormat.KEY_CHANNEL_COUNT))
        if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) builder.setSampleRate(format.getInteger(MediaFormat.KEY_SAMPLE_RATE))
        val csd = mutableListOf<ByteArray>()
        for (i in 0..3) {
            val key = "csd-$i"
            if (!format.containsKey(key)) continue
            val source = format.getByteBuffer(key)?.duplicate() ?: continue
            val bytes = ByteArray(source.remaining())
            source.get(bytes)
            csd.add(bytes)
        }
        if (csd.isNotEmpty()) builder.setInitializationData(csd)
        return builder.build()
    }

    private fun readDurationUs(descriptor: android.os.ParcelFileDescriptor?): Long {
        val retriever = MediaMetadataRetriever()
        return try {
            val source = sourceUrl.trim()
            when {
                descriptor != null -> retriever.setDataSource(descriptor.fileDescriptor)
                isLocal || source.startsWith("file://") || source.startsWith("/") ->
                    retriever.setDataSource(source.removePrefix("file://"))
                else -> retriever.setDataSource(source, headers)
            }
            (retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L) * 1000L
        } catch (_: Exception) {
            0L
        } finally {
            retriever.release()
        }
    }

    private fun videoTracks(extractor: MediaExtractor) = (0 until extractor.trackCount).filter {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true
    }

    private fun audioTracks(extractor: MediaExtractor) = (0 until extractor.trackCount).filter {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
    }

    private fun openExtractor(): Pair<MediaExtractor, android.os.ParcelFileDescriptor?> {
        val extractor = MediaExtractor()
        var descriptor: android.os.ParcelFileDescriptor? = null
        try {
            val source = sourceUrl.trim()
            when {
                source.startsWith("content://") -> {
                    descriptor = context.contentResolver.openFileDescriptor(Uri.parse(source), "r")
                        ?: throw IllegalArgumentException("Cannot open local video")
                    extractor.setDataSource(descriptor.fileDescriptor)
                }
                isLocal || source.startsWith("file://") || source.startsWith("/") ->
                    extractor.setDataSource(source.removePrefix("file://"))
                else -> extractor.setDataSource(source, headers)
            }
            return extractor to descriptor
        } catch (error: Exception) {
            extractor.release()
            descriptor?.close()
            throw error
        }
    }
}
