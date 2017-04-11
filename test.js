import fs from 'fs'
import path from 'path'
import tempfile from 'tempfile'
import mkdirp from 'mkdirp'
import test from 'ava'
import del from 'del'
import steamcmd from './'

test.before(() => {
  mkdirp.sync('test_data')
})

test.after.always(() => {
  return del('test_data')
})

test.beforeEach(t => {
  const binDirParent = tempfile('/')
  mkdirp.sync(binDirParent)
  const binDir = path.join(binDirParent, 'steamcmd_bin')
  const appDir = binDir
  const opts = {appDir, binDir}
  t.context = {binDirParent, binDir, opts}
})

test.afterEach(async t => {
  await del(t.context.binDirParent, {force: true})
})

test('download', async t => {
  var {binDir, opts} = t.context
  await steamcmd.download(opts)
  t.notThrows(() => {
    fs.statSync(binDir)
  })
})

test('touch', async t => {
  var {binDir, opts} = t.context
  await steamcmd.download(opts)
  // fix random EBUSY on Windows
  await new Promise(resolve => setTimeout(resolve, 200))
  await steamcmd.touch(opts)
  t.notThrows(() => {
    fs.statSync(path.join(binDir, 'public'))
  })
})

test('prep', async t => {
  var {binDir, opts} = t.context
  await steamcmd.prep(opts)
  t.notThrows(() => fs.statSync(path.join(binDir, 'public')))
})

test('getAppInfo', async t => {
  var {opts} = t.context
  await steamcmd.prep(opts)
  const csgoAppInfo = await steamcmd.getAppInfo(730, opts)
  t.is(csgoAppInfo.common.name, 'Counter-Strike: Global Offensive')
  // Ensure the whole text is parsed by checking the last element
  t.truthy(csgoAppInfo.ufs)
})

test('repeated calls to getAppInfo', async t => {
  var {opts} = t.context
  await steamcmd.prep(opts)
  const csgoAppInfo = await steamcmd.getAppInfo(730, opts)
  t.is(csgoAppInfo.common.name, 'Counter-Strike: Global Offensive')
  t.notThrows(steamcmd.getAppInfo(730, opts))
})

test('getAppVersionRemote', async t => {
  var {opts} = t.context
  await steamcmd.prep(opts)
  // main branch
  let info = await steamcmd.getAppVersionRemote(730, '', opts)
  t.regex(info.buildId, /\d+/)
  t.falsy(info.description)
  t.true(info.updatedAt && new Date(0) < info.updatedAt)
  // different branch
  info = await steamcmd.getAppVersionRemote(730, '1.21.3.1', opts)
  t.is(info.buildId, '611429')
  t.is(info.description, 'Game version 1.21.3.1 (16-Nov-2012)')
  t.falsy(info.updatedAt)
})

test('updateApp with a relative path', async t => {
  var {opts} = t.context
  opts.appDir = './relative/path'
  await steamcmd.prep(opts)
  t.throws(() => steamcmd.updateApp(1007, opts))
  t.throws(() => fs.statSync(opts.appDir))
})

test('updateApp with a nonexistent app', async t => {
  var {opts} = t.context
  await steamcmd.prep(opts)
  t.throws(steamcmd.updateApp(4, opts))
})

test('updateApp with valid parameters', async t => {
  var {opts} = t.context
  await steamcmd.prep(opts)
  t.true(await steamcmd.updateApp(1007, opts))
})

test('updateApp with HLDS workaround', async t => {
  var {opts} = t.context
  await steamcmd.prep(opts)
  t.true(await steamcmd.updateApp(90, opts))
})

test('updateApp on already up-to-date app returns false', async t => {
  var {opts} = t.context
  const appId = 1007
  await steamcmd.prep(opts)
  await steamcmd.updateApp(appId, opts)
  t.false(await steamcmd.updateApp(appId, opts))
})

test('getAppVersionInstalled', async t => {
  var {binDirParent, opts} = t.context
  const appId = 1007
  await steamcmd.prep(opts)

  // Main dir
  await steamcmd.updateApp(appId, opts)
  let version = await steamcmd.getAppVersionInstalled(appId, opts)
  t.regex(version.buildId, /\d+/)
  t.falsy(version.branch)
  t.true(version.updatedAt && new Date(0) < version.updatedAt)

  // Other dir
  opts.appDir = path.join(path.join(binDirParent, 'some_dir'), 'app')
  await steamcmd.updateApp(appId, opts)
  version = await steamcmd.getAppVersionInstalled(appId, opts)
  t.regex(version.buildId, /\d+/)
  t.falsy(version.branch)
  t.true(version.updatedAt && new Date(0) < version.updatedAt)

  // @todo enable installing branch so can test that
  /*
  // different branch & dir
  installDir = path.join(binDir, 'app')
  branch = '1.21.3.1'
  await steamcmd.updateApp(appId, branch, installDir, opts)
  version = await steamcmd.getAppVersionRemote(appId, installDir, opts)
  t.is(version.buildId, '611429')
  t.is(version.branch, branch)
  t.true(version.updatedAt && new Date(0) < version.updatedAt)
  */
})
