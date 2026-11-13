// SPDX-License-Identifier: Apache-2.0
// Faithful check of the uv lock header Renovate's pip-compile manager accepts.
// Continuous integration runs this with the existing Node test command. It does
// not import the Renovate package. The rules below follow extractHeaderCommand
// and inferCommandExecDir in Renovate 44.236.5: equals-form options, rejection
// of the short -o output option, and command-directory inference.
import assert from 'node:assert/strict'
import test from 'node:test'
import { access, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { posix } from 'node:path'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const read = path => readFile(posix.join(root, path), 'utf8')
const headerPattern = /^(?:#.*?\r?\n)+# {4}(?<command>\S*)(?<arguments>.*?)?\r?\n/
const uvFlags = new Set([
  '-v', '--generate-hashes', '--emit-index-url', '--index-url', '--all-extras',
  '--no-strip-extras', '--universal', '--no-emit-index-url',
])
const uvOptionsWithValue = new Set([
  '--output-file', '--extra', '--extra-index-url', '--constraints', '--constraint',
  '--python-version', '--no-emit-package', '--prerelease', '--format', '--resolution',
  '--fork-strategy', '--exclude-newer', '--exclude-newer-package', '--group',
  '--override', '--overrides',
])

function inferCommandExecDir(outputFilePath, outputFileArg) {
  if (!outputFileArg) return posix.normalize(posix.dirname(outputFilePath))
  const outputArg = posix.normalize(outputFileArg)
  if (outputArg.startsWith('..')) {
    throw new Error(`Cannot infer command execution directory from path ${outputFileArg}`)
  }
  if (posix.basename(outputArg) !== posix.basename(outputFilePath)) {
    throw new Error(`Output file name mismatch: ${posix.basename(outputArg)} vs ${posix.basename(outputFilePath)}`)
  }
  const outputFileDir = posix.normalize(posix.dirname(outputArg))
  let commandExecDir = posix.normalize(posix.dirname(outputFilePath))
  for (const dir of outputFileDir.split('/').reverse()) {
    if (commandExecDir.endsWith(dir)) commandExecDir = posix.join(commandExecDir.slice(0, -dir.length), '.')
    else break
  }
  if (commandExecDir.endsWith('/') && commandExecDir.length > 1) commandExecDir = commandExecDir.slice(0, -1)
  return commandExecDir
}

function parseUvHeader(content, fileName) {
  const match = headerPattern.exec(content)
  if (!match?.groups) throw new Error(`Failed to extract command from header in ${fileName}`)
  const command = match.groups.command
  if (command !== 'uv') throw new Error(`Expected uv compile command in ${fileName}`)
  const argv = [command, ...match.groups.arguments.trim().split(/\s+/).filter(Boolean)]
  const parsed = {argv, command, commandType: 'uv', outputFile: '', sourceFiles: []}
  for (const arg of argv.slice(1)) {
    if (arg === 'pip' || arg === 'compile') continue
    if (!arg.startsWith('-')) {
      parsed.sourceFiles.push(arg)
      continue
    }
    const option = arg.includes('=') ? arg.split('=')[0] : arg
    if (uvOptionsWithValue.has(option) && !arg.includes('=')) {
      throw new Error(`Option ${arg} must have equal sign '=' separating it's argument`)
    }
    if (!uvFlags.has(arg) && !uvOptionsWithValue.has(option)) {
      throw new Error(`Option ${arg} not supported (yet)`)
    }
    if (option === '--output-file') parsed.outputFile = posix.normalize(arg.slice(option.length + 1))
  }
  if (parsed.sourceFiles.length === 0) {
    throw new Error('No source files detected in command, pass at least one package file explicitly')
  }
  const compileDir = inferCommandExecDir(fileName, parsed.outputFile)
  return {
    ...parsed,
    compileDir,
    sourceFiles: parsed.sourceFiles.map(source => posix.normalize(posix.join(compileDir, source))),
    outputFile: posix.normalize(posix.join(compileDir, parsed.outputFile)),
  }
}

test('manual lock header resolves to its requirements input and lock', async () => {
  const lock = 'tools/manual/requirements.lock'
  const source = 'tools/manual/requirements.in'
  const content = await read(lock)
  const parsed = parseUvHeader(content, lock)
  assert.deepEqual(parsed.argv, [
    'uv', 'pip', 'compile', source, '--generate-hashes', `--output-file=${lock}`,
  ])
  assert.equal(parsed.compileDir, '.')
  assert.deepEqual(parsed.sourceFiles, [source])
  assert.equal(parsed.outputFile, lock)
  await access(posix.join(root, source))
  await access(posix.join(root, lock))
  const rejected = content.replace(`--output-file=${lock}`, `-o ${lock}`)
  assert.throws(() => parseUvHeader(rejected, lock), /Option -o not supported \(yet\)/)
})

test('generated-docs lock header resolves beside its requirements input', async () => {
  const lock = 'templates/generated-docs/requirements.lock'
  const source = 'templates/generated-docs/requirements.in'
  const parsed = parseUvHeader(await read(lock), lock)
  assert.deepEqual(parsed.argv, [
    'uv', 'pip', 'compile', 'requirements.in', '--generate-hashes', '--output-file=requirements.lock',
  ])
  assert.equal(parsed.compileDir, 'templates/generated-docs')
  assert.deepEqual(parsed.sourceFiles, [source])
  assert.equal(parsed.outputFile, lock)
  await access(posix.join(root, source))
})
