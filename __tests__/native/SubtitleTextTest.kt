package com.vega

/** Standalone checks for EmbeddedSubtitleVtt's pure text conversion methods. */
fun main() {
    val srt = EmbeddedSubtitleVtt.parseText("1\n00:00:01,500 --> 00:00:04,000\nHello\nworld\n")
    check(srt.single().startUs == 1_500_000L)
    check(srt.single().endUs == 4_000_000L)
    check(EmbeddedSubtitleVtt.toVtt(srt, 2_000_000L).contains("00:00:00.000 --> 00:00:02.000\nHello\nworld"))

    val ass = EmbeddedSubtitleVtt.parseText("""
        [Script Info]
        Title: Test
        [Events]
        Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
        Comment: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Not a cue
        Dialogue: 0,0:00:01.25,0:00:03.50,Default,,0,0,0,,{\an8}Hello, world\NSecond\nThird\hword
    """.trimIndent())
    check(ass.single().startUs == 1_250_000L)
    check(ass.single().endUs == 3_500_000L)
    check(ass.single().text == "Hello, world\nSecond\nThird\u00A0word")
    check(EmbeddedSubtitleVtt.toVtt(ass, 4_000_000L) == "WEBVTT\n\n")

    val ssa = EmbeddedSubtitleVtt.parseText("""
        [Events]
        Format: Marked, End, Start, Style, Name, MarginL, MarginR, MarginV, Effect, Text
        Dialogue: Marked=0,0:00:09.00,0:00:05.00,Default,,0,0,0,,SSA, with comma
    """.trimIndent())
    check(ssa.single().startUs == 5_000_000L && ssa.single().endUs == 9_000_000L)
    check(ssa.single().text == "SSA, with comma")

    val vtt = EmbeddedSubtitleVtt.parseText("WEBVTT\n\n00:01.000 --> 00:02.000\nExisting VTT\n")
    check(vtt.single().text == "Existing VTT")
    check(EmbeddedSubtitleVtt.toVtt(vtt, 0L).contains("00:00:01.000 --> 00:00:02.000"))
    println("Subtitle conversion checks passed: SRT, ASS, SSA, VTT, and timeline rebasing")
}
