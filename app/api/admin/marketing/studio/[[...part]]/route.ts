/**
 * /api/admin/marketing/studio[/part]?key=<video key> — the Studio's editing suite, one cut (admins only).
 *   GET              {review, edits}          the cut's file (lib/studio/store.ts), for the page's polling
 *   GET  /render     {render}                 Claude's render progress
 *   GET  /strip      the filmstrip picture    (a redirect into storage; dev: this computer)
 *   GET  /stem/<l>   a sound stem (voice|music|sfx)
 *   PUT              {comments}               review notes (the whole list)
 *   PUT  /edits      {edits}                  edits for Claude (the whole list)
 *   PUT  /qc         {id, state, as?}         an answer to an auto-QC flag or taste note
 *   POST /requests   {type, ids?}             a press that needs Claude (apply_edits, render_one, render_all)
 * Everything is one small JSON beside the video in the Marketing storage (Cloudflare R2). Nothing commits.
 */
import fs from 'node:fs'
import { NextResponse } from 'next/server'
import { gate, NOT_CONNECTED_TEXT } from '@/lib/marketing/mediaApi'
import { mediaOf, playUrl } from '@/lib/marketing/r2'
import { devSideFile, getStorage } from '@/lib/marketing/storage'
import { getCaller } from '@/lib/marketing/caller'
import { addRequest, readCut, saveComments, saveEditList, saveQcAnswer, SIDE, STEM_LANES } from '@/lib/studio/store'

export const dynamic = 'force-dynamic'
const H = { 'Cache-Control': 'no-store' }
type Ctx = { params: { part?: string[] } }

async function open(req: Request) {
  const denied = gate(await getCaller())
  if (denied) return { error: NextResponse.json(denied.body, { status: denied.status, headers: H }) }
  const caller = (await getCaller())!
  const store = getStorage()
  if (store.mode === 'off') return { error: NextResponse.json({ error: NOT_CONNECTED_TEXT }, { status: 503, headers: H }) }
  const key = new URL(req.url).searchParams.get('key') ?? ''
  if (!store.isMediaKey(key)) return { error: NextResponse.json({ error: 'Which video?' }, { status: 400, headers: H }) }
  return { store, key, caller }
}
const fail = (e: unknown) => NextResponse.json({ error: (e as Error).message || 'Storage could not be reached.' }, { status: 502, headers: H })
const reply = (r: { ok: true; value: unknown } | { ok: false; status: number; error: string }, name: string) =>
  r.ok ? NextResponse.json({ [name]: r.value }, { headers: H }) : NextResponse.json({ error: r.error }, { status: r.status, headers: H })

export async function GET(req: Request, { params }: Ctx) {
  const o = await open(req)
  if ('error' in o) return o.error
  const part = (params.part ?? []).join('/')
  try {
    if (part === '') {
      const cut = await readCut(o.store, o.key)
      return NextResponse.json({ review: cut.review, edits: cut.edits }, { headers: H })
    }
    if (part === 'render') return NextResponse.json({ render: (await readCut(o.store, o.key)).render }, { headers: H })
    let file: string | null = null
    if (part === 'strip') file = o.key + SIDE.strip
    const stem = /^stem\/([a-z]+)$/.exec(part)?.[1]
    if (stem && (STEM_LANES as readonly string[]).includes(stem)) file = `${o.key}.${stem}.mp4`
    if (!file) return NextResponse.json({ error: 'Not a part of the suite.' }, { status: 404, headers: H })
    if (o.store.mode === 'r2' && o.store.config) return NextResponse.redirect(playUrl(o.store.config, file, new Date()), { status: 302 })
    const local = devSideFile(file)
    if (!fs.existsSync(local)) return NextResponse.json({ error: 'Not made yet.' }, { status: 404, headers: H })
    return new NextResponse(fs.readFileSync(local), { headers: { 'Content-Type': mediaOf(file)?.mime ?? 'application/octet-stream', ...H } })
  } catch (e) {
    return fail(e)
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const o = await open(req)
  if ('error' in o) return o.error
  const part = (params.part ?? []).join('/')
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  try {
    if (part === '') return reply(await saveComments(o.store, o.key, body?.comments, o.caller.name), 'comments')
    if (part === 'edits') return reply(await saveEditList(o.store, o.key, body?.edits), 'edits')
    if (part === 'qc') return reply(await saveQcAnswer(o.store, o.key, body, new Date().toISOString()), 'ok')
    return NextResponse.json({ error: 'Not a part of the suite.' }, { status: 404, headers: H })
  } catch (e) {
    return fail(e)
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const o = await open(req)
  if ('error' in o) return o.error
  if ((params.part ?? []).join('/') !== 'requests') return NextResponse.json({ error: 'Not a part of the suite.' }, { status: 404, headers: H })
  try {
    return reply(await addRequest(o.store, o.key, await req.json().catch(() => null), new Date().toISOString()), 'request')
  } catch (e) {
    return fail(e)
  }
}
