package uk.co.knowitball.goalvideo

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.typedarray.Int16Array
import expo.modules.kotlin.typedarray.Uint8Array
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * GOAL VIDEOS TO AN MP4 FILE ON THE PHONE (Android: MediaCodec + MediaMuxer).
 *
 * The website (lib/star/goalClip/encode.ts) hands each drawn frame to the
 * browser's video encoder and the mixed sound to its audio encoder, then
 * writes an MP4: H.264 at the edit's size and frame rate, a key frame every
 * 2 s, AAC at 96 kb/s. This is the same on the phone's own encoders:
 *   start(name, w, h, fps, bitrate, sampleRate, channels, pcm)  the whole mixed
 *       sound up front (16-bit, interleaved), fed in step with the pictures;
 *   addFrame(rgba)  one frame's pixels (w*h*4, from Skia), turned into YUV;
 *   finish()        the file: { uri, bytes };
 *   cancel()        drops it;
 *   decodeAudio(uri) a sound file as 16-bit samples (8-byte header: rate,
 *       channels), for the phone's own mix (src/match/goalClip/clipMix.ts).
 * One video at a time.
 */
class GoalVideoEncoderModule : Module() {
  private var job: Mp4Job? = null

  override fun definition() = ModuleDefinition {
    Name("GoalVideoEncoder")

    Function("isAvailable") { hasAvcEncoder() }

    Function("start") { name: String, width: Int, height: Int, fps: Int, bitrate: Int, sampleRate: Int, channels: Int, pcm: Int16Array ->
      job?.release()
      job = null
      val dir = File(appContext.cacheDirectory, "goal-videos").apply { mkdirs() }
      // Old videos from earlier goes are not kept: the gallery has its own copy.
      dir.listFiles()?.forEach { if (it.name != name) it.delete() }
      val samples = ShortArray(pcm.length)
      if (pcm.length > 0) pcm.toDirectBuffer().order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(samples)
      job = Mp4Job(File(dir, name), width, height, fps, bitrate, sampleRate, channels, if (samples.isEmpty()) null else samples)
      true
    }

    Function("addFrame") { rgba: Uint8Array ->
      val j = job ?: throw NoJobException()
      val bytes = ByteArray(rgba.byteLength)
      rgba.toDirectBuffer().get(bytes)
      j.addFrame(bytes)
    }

    AsyncFunction("finish") {
      val j = job ?: throw NoJobException()
      job = null
      val f = j.finish()
      mapOf("uri" to Uri.fromFile(f).toString(), "bytes" to f.length().toDouble())
    }

    Function("cancel") {
      job?.release()
      job = null
    }

    AsyncFunction("decodeAudio") { uri: String -> decodeAudio(uri) }
  }

  private fun hasAvcEncoder(): Boolean = try {
    MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.any { info ->
      info.isEncoder && info.supportedTypes.any { it.equals(MediaFormat.MIMETYPE_VIDEO_AVC, ignoreCase = true) }
    }
  } catch (e: Exception) { false }

  private fun decodeAudio(uri: String): ByteArray {
    val ex = MediaExtractor()
    try {
      when {
        uri.startsWith("file://") -> ex.setDataSource(Uri.parse(uri).path!!)
        uri.startsWith("/") -> ex.setDataSource(uri)
        else -> ex.setDataSource(appContext.reactContext ?: throw NoContextException(), Uri.parse(uri), null)
      }
      var track = -1
      for (i in 0 until ex.trackCount) {
        if (ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) { track = i; break }
      }
      if (track < 0) throw DecodeException("no sound in $uri")
      ex.selectTrack(track)
      val inFmt = ex.getTrackFormat(track)
      var rate = inFmt.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var chans = inFmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      var isFloat = false
      val dec = MediaCodec.createDecoderByType(inFmt.getString(MediaFormat.KEY_MIME)!!)
      dec.configure(inFmt, null, null, 0)
      dec.start()
      val out = ByteArrayOutputStream()
      val info = MediaCodec.BufferInfo()
      var inDone = false
      var idle = 0
      try {
        while (true) {
          if (!inDone) {
            val i = dec.dequeueInputBuffer(10_000)
            if (i >= 0) {
              val buf = dec.getInputBuffer(i)!!
              val n = ex.readSampleData(buf, 0)
              if (n < 0) {
                dec.queueInputBuffer(i, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                inDone = true
              } else {
                dec.queueInputBuffer(i, 0, n, ex.sampleTime, 0)
                ex.advance()
              }
            }
          }
          val o = dec.dequeueOutputBuffer(info, 10_000)
          if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            val f = dec.outputFormat
            rate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            chans = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            isFloat = Build.VERSION.SDK_INT >= 24 && f.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
              f.getInteger(MediaFormat.KEY_PCM_ENCODING) == android.media.AudioFormat.ENCODING_PCM_FLOAT
          } else if (o >= 0) {
            idle = 0
            val buf = dec.getOutputBuffer(o)!!
            buf.position(info.offset)
            buf.limit(info.offset + info.size)
            if (isFloat) {
              val fb = buf.order(ByteOrder.nativeOrder()).asFloatBuffer()
              val tmp = ByteBuffer.allocate(fb.remaining() * 2).order(ByteOrder.LITTLE_ENDIAN)
              while (fb.hasRemaining()) tmp.putShort((fb.get().coerceIn(-1f, 1f) * 32767f).toInt().toShort())
              out.write(tmp.array())
            } else {
              val sb = buf.order(ByteOrder.nativeOrder()).asShortBuffer()
              val tmp = ByteBuffer.allocate(sb.remaining() * 2).order(ByteOrder.LITTLE_ENDIAN)
              while (sb.hasRemaining()) tmp.putShort(sb.get())
              out.write(tmp.array())
            }
            dec.releaseOutputBuffer(o, false)
            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
          } else if (o == MediaCodec.INFO_TRY_AGAIN_LATER && inDone && ++idle > 300) {
            break
          }
        }
      } finally {
        try { dec.stop() } catch (_: Exception) {}
        dec.release()
      }
      val head = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putInt(rate).putInt(chans).array()
      return head + out.toByteArray()
    } finally {
      ex.release()
    }
  }
}

class NoJobException : CodedException("No goal video is being made")
class NoContextException : CodedException("The app is not ready")
class DecodeException(msg: String) : CodedException(msg)

private class Mp4Job(
  private val file: File,
  private val w: Int,
  private val h: Int,
  private val fps: Int,
  bitrate: Int,
  private val sampleRate: Int,
  private val channels: Int,
  private val pcm: ShortArray?,
) {
  private class Pending(val audio: Boolean, val data: ByteArray, val pts: Long, val flags: Int)

  private val muxer = MediaMuxer(file.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
  private val venc: MediaCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
  private val aenc: MediaCodec?
  private var vTrack = -1
  private var aTrack = -1
  private var started = false
  private var vEos = false
  private var aEos = false
  private val pending = ArrayList<Pending>()
  private var frames = 0
  private var audioDone = 0
  private val info = MediaCodec.BufferInfo()
  private val yPlane = ByteArray(w * h)
  private val uPlane = ByteArray(((w + 1) / 2) * ((h + 1) / 2))
  private val vPlane = ByteArray(uPlane.size)

  init {
    val base = { profile: Boolean ->
      MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, w, h).apply {
        setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
        setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
        setInteger(MediaFormat.KEY_FRAME_RATE, fps)
        setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
        if (profile) {
          // The website asks for Baseline first (avc1.42E01F): no B-frames, plays everywhere.
          setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline)
          setInteger(MediaFormat.KEY_LEVEL, MediaCodecInfo.CodecProfileLevel.AVCLevel31)
        }
      }
    }
    try {
      venc.configure(base(true), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    } catch (e: Exception) {
      venc.configure(base(false), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    }
    venc.start()
    aenc = if (pcm != null) {
      val af = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channels).apply {
        setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
        setInteger(MediaFormat.KEY_BIT_RATE, 96_000)
        setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16_384)
      }
      try {
        MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC).also { it.configure(af, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE); it.start() }
      } catch (e: Exception) { null } // no AAC encoder: the file is silent, as on the website
    } else null
  }

  private fun pts(frame: Int): Long = frame * 1_000_000L / fps

  fun addFrame(rgba: ByteArray) {
    if (rgba.size < w * h * 4) throw DecodeException("frame is ${rgba.size} bytes, wanted ${w * h * 4}")
    feedAudio(((frames + 1).toLong() * sampleRate + fps - 1) / fps)
    toYuv(rgba)
    var i: Int
    while (true) {
      i = venc.dequeueInputBuffer(5_000)
      if (i >= 0) break
      drain(false)
    }
    val size = writeInput(i)
    venc.queueInputBuffer(i, 0, size, pts(frames), 0)
    frames++
    drain(false)
  }

  /** BT.601, studio range: what an H.264 file from a camera is. Chroma is the 2x2 average. */
  private fun toYuv(px: ByteArray) {
    val cw = (w + 1) / 2
    for (y in 0 until h) {
      var p = y * w * 4
      val row = y * w
      for (x in 0 until w) {
        val r = px[p].toInt() and 0xff; val g = px[p + 1].toInt() and 0xff; val b = px[p + 2].toInt() and 0xff
        yPlane[row + x] = (((66 * r + 129 * g + 25 * b + 128) shr 8) + 16).toByte()
        p += 4
      }
    }
    for (cy in 0 until (h + 1) / 2) {
      for (cx in 0 until cw) {
        var r = 0; var g = 0; var b = 0; var n = 0
        for (dy in 0..1) for (dx in 0..1) {
          val x = cx * 2 + dx; val y = cy * 2 + dy
          if (x < w && y < h) {
            val p = (y * w + x) * 4
            r += px[p].toInt() and 0xff; g += px[p + 1].toInt() and 0xff; b += px[p + 2].toInt() and 0xff; n++
          }
        }
        r /= n; g /= n; b /= n
        uPlane[cy * cw + cx] = (((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128).toByte()
        vPlane[cy * cw + cx] = (((112 * r - 94 * g - 18 * b + 128) shr 8) + 128).toByte()
      }
    }
  }

  /** Copies the planes into the encoder's input, in whatever layout it asks for. */
  private fun writeInput(index: Int): Int {
    val cap = venc.getInputBuffer(index)?.capacity() ?: 0
    val img = try { venc.getInputImage(index) } catch (e: Exception) { null }
    val cw = (w + 1) / 2; val ch = (h + 1) / 2
    if (img != null) {
      val planes = img.planes
      val src = arrayOf(yPlane, uPlane, vPlane)
      for (k in 0..2) {
        val pl = planes[k]
        val buf = pl.buffer
        val pw = if (k == 0) w else cw
        val ph = if (k == 0) h else ch
        val rs = pl.rowStride; val ps = pl.pixelStride
        val s = src[k]
        for (y in 0 until ph) {
          val base = y * rs
          if (ps == 1) {
            buf.position(base)
            buf.put(s, y * pw, pw)
          } else {
            for (x in 0 until pw) buf.put(base + x * ps, s[y * pw + x])
          }
        }
      }
      val want = w * h + 2 * cw * ch
      return if (cap > 0) minOf(cap, want) else want
    }
    // No image view: plain I420 (planar), the flexible format's usual layout.
    val buf = venc.getInputBuffer(index)!!
    buf.clear()
    buf.put(yPlane); buf.put(uPlane); buf.put(vPlane)
    return yPlane.size + uPlane.size + vPlane.size
  }

  private fun feedAudio(untilFrame: Long) {
    val a = aenc ?: return
    val all = pcm ?: return
    val total = all.size / channels
    val end = minOf(total.toLong(), untilFrame).toInt()
    while (audioDone < end) {
      val i = a.dequeueInputBuffer(5_000)
      if (i < 0) { drain(false); continue }
      val buf = a.getInputBuffer(i)!!
      buf.clear()
      val n = minOf(1024, buf.capacity() / (2 * channels), end - audioDone)
      buf.order(ByteOrder.nativeOrder()).asShortBuffer().put(all, audioDone * channels, n * channels)
      a.queueInputBuffer(i, 0, n * 2 * channels, audioDone * 1_000_000L / sampleRate, 0)
      audioDone += n
      drain(false)
    }
  }

  private fun maybeStart() {
    if (started || vTrack < 0 || (aenc != null && aTrack < 0)) return
    muxer.start()
    started = true
    for (p in pending) write(p.audio, ByteBuffer.wrap(p.data), p.data.size, p.pts, p.flags)
    pending.clear()
  }

  private fun write(audio: Boolean, data: ByteBuffer, size: Int, pts: Long, flags: Int) {
    val bi = MediaCodec.BufferInfo().apply { set(0, size, pts, flags) }
    data.position(0); data.limit(size)
    muxer.writeSampleData(if (audio) aTrack else vTrack, data, bi)
  }

  /** Takes what the encoders have made and writes it (or keeps it until the file has both tracks). */
  private fun drain(waitForEnd: Boolean) {
    for (audio in listOf(false, true)) {
      val c = (if (audio) aenc else venc) ?: continue
      if (if (audio) aEos else vEos) continue
      var tries = 0
      while (true) {
        val o = c.dequeueOutputBuffer(info, if (waitForEnd) 10_000 else 0)
        if (o == MediaCodec.INFO_TRY_AGAIN_LATER) {
          if (!waitForEnd || ++tries > 500) break
          continue
        }
        if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          if (audio) aTrack = muxer.addTrack(c.outputFormat) else vTrack = muxer.addTrack(c.outputFormat)
          maybeStart()
          continue
        }
        if (o < 0) continue
        val buf = c.getOutputBuffer(o)!!
        val config = info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
        if (!config && info.size > 0) {
          buf.position(info.offset); buf.limit(info.offset + info.size)
          val flags = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM.inv()
          if (started) {
            muxer.writeSampleData(if (audio) aTrack else vTrack, buf, MediaCodec.BufferInfo().apply { set(info.offset, info.size, info.presentationTimeUs, flags) })
          } else {
            val copy = ByteArray(info.size); buf.get(copy)
            pending.add(Pending(audio, copy, info.presentationTimeUs, flags))
          }
        }
        c.releaseOutputBuffer(o, false)
        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
          if (audio) aEos = true else vEos = true
          break
        }
      }
    }
  }

  private fun endOf(c: MediaCodec, pts: Long) {
    var tries = 0
    while (tries++ < 400) {
      val i = c.dequeueInputBuffer(10_000)
      if (i >= 0) { c.queueInputBuffer(i, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM); return }
      drain(false)
    }
  }

  fun finish(): File {
    try {
      feedAudio(Long.MAX_VALUE)
      endOf(venc, pts(frames))
      aenc?.let { endOf(it, audioDone * 1_000_000L / sampleRate) }
      var rounds = 0
      while ((!vEos || (aenc != null && !aEos)) && rounds++ < 20) drain(true)
      if (!started) throw DecodeException("the encoder made no video")
      muxer.stop()
    } catch (e: Exception) {
      release()
      file.delete()
      throw e
    }
    release()
    return file
  }

  fun release() {
    try { venc.stop() } catch (_: Exception) {}
    try { venc.release() } catch (_: Exception) {}
    try { aenc?.stop() } catch (_: Exception) {}
    try { aenc?.release() } catch (_: Exception) {}
    try { muxer.release() } catch (_: Exception) {}
  }
}
